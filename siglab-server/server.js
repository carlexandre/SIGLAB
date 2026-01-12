const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000; 
const API_URL = 'http://localhost:3001/api';

const { verifyLogin, blacklist } = require('./verify.js');
const { checkTipo } = require('./permition.js');

require("dotenv-safe").config();

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 
app.set('view engine', 'ejs');
app.set('views', './views'); 

// O arquivo fica na RAM apenas o tempo suficiente para enviar à API
const upload = multer({ storage: multer.memoryStorage() });

// Função para facilitar chamadas GET
async function getData(endpoint) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Erro ao buscar ${endpoint}:`, error);
        return null;
    }
}

// Função para facilitar chamadas POST/PUT
async function postData(endpoint, data, method = 'POST') {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response;
    } catch (error) {
        console.error(`Erro ao enviar para ${endpoint}:`, error);
        return { ok: false };
    }
}

// ROTAS
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    var sha512 = (pwd, key) => {
        var hash = crypto.createHmac('sha512', key);
        hash.update(pwd);
        return hash.digest('hex'); 
    };

    var email = req.body.email;
    var password = sha512(req.body.password, process.env.SECRET_USERS);

    if (email && password) {
        const users = await getData('/usuarios');
        
        if (users) {
            var userloc = users.find((item) => item.email == email && item.password == password);
            if (userloc) {
                const token = jwt.sign(
                    { id: userloc.id, tipo: userloc.tipo, matricula: userloc.matricula },
                    process.env.SECRET,
                    { expiresIn: 3600 }
                );
                res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
                return res.redirect('/');
            }
        }
    }
    return res.send(`<script>alert('Usuário e/ou senha inválidos'); window.history.back();</script>`);
});

app.get('/logout', verifyLogin, (req, res) => {
    const token = req.cookies.token;
    if (token) blacklist.push(token); 
    res.clearCookie('token');
    res.redirect('/login');
});

// Cadastro de usuário
app.get('/cadastro/usuario', verifyLogin, checkTipo(['admin']), (req, res) => res.render('cadastro_user'));

app.post('/cadastro/usuario', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { nome, email, tipo, matricula } = req.body;

    const criarHash = (pwd) => {
        const hash = crypto.createHmac('sha512', process.env.SECRET_USERS);
        hash.update(pwd);
        return hash.digest('hex');
    };

    const novoUsuario = {
        nome, email, tipo, matricula,
        password: criarHash(matricula)
    };

    const response = await postData('/usuarios', novoUsuario);

    if (response.ok) {
        res.send(`<script>alert("Usuário cadastrado com sucesso!"); window.location.href = "/";</script>`);
    } else if (response.status === 409) {
        res.send(`<script>alert("Erro: Este email já está cadastrado."); window.history.back();</script>`);
    } else {
        res.send(`<script>alert("Erro ao cadastrar usuário na API."); window.history.back();</script>`);
    }
});

// ADMIN
app.get('/', verifyLogin, checkTipo(['admin']), (req, res) => res.render('index'));

// HISTÓRICO
app.get('/historico', verifyLogin, checkTipo(['admin']), (req, res) => res.redirect('/historico/geral'));

app.get('/historico/:id_lab', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const id = req.params.id_lab;
    
    // Busca dados da API em paralelo
    const [reservas, usersData, laboratorios] = await Promise.all([
        getData('/reservas'),
        getData('/acessos'),
        getData('/laboratorios')
    ]);

    let historico_reservas = reservas || [];
    let historico_user = usersData || [];
    
    if (id !== 'geral') {
        historico_reservas = historico_reservas.filter(r => r.id_lab === id);
        historico_user = historico_user.filter(u => u.id_lab === id);
    }

    const agora = new Date();
    const next = historico_reservas.filter(r => new Date(r.data_inicio) >= agora);
    const last = historico_reservas.filter(r => new Date(r.data_fim || r.data_inicio) < agora);

    res.render('historicos', { 
        proximas: next, 
        passadas: last, 
        usuarios: historico_user, 
        lab: laboratorios || [], 
        lab_nome: id === 'geral' ? 'Geral' : (laboratorios.find(l => l.id === id)?.nome || '') 
    });
});

// DISPONIBILIDADE
app.get('/disponibilidade/:id_lab', verifyLogin, async (req, res) => {
    const id = req.params.id_lab;
    const [todasReservas, laboratorios] = await Promise.all([
        getData('/reservas'),
        getData('/laboratorios')
    ]);

    if (id === 'geral') {
        res.render('disponibilidade', { reservas: todasReservas, lab_id: 'geral', lab_nome: 'Geral' });
    } else {
        const reservas_lab = todasReservas.filter(r => r.id_lab === id);
        const lab = laboratorios.find(l => l.id === id);
        res.render('disponibilidade', { reservas: reservas_lab, lab_id: lab.id, lab_nome: lab.nome });
    }
});

// LABORATÓRIOS
app.get('/laboratorios', verifyLogin, async (req, res) => {
    const laboratorios = await getData('/laboratorios');
    res.render('lista_laboratorios', { laboratorios: laboratorios || [] });
});

app.get('/laboratorios/:id_lab', verifyLogin, async (req, res) => {
    const lab = await getData(`/laboratorios/${req.params.id_lab}`);
    if (!lab) return res.status(404).send('Laboratório não encontrado.');
    res.render('laboratorio', { lab: lab, user: req.user });
});

app.get('/cadastro/laboratorios', verifyLogin, checkTipo(['admin']), (req, res) => res.render('cadastro_lab'));

app.post('/cadastro/laboratorios', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const response = await postData('/laboratorios', req.body);
    if (response.ok) {
        res.send(`<script>alert("Laboratório cadastrado!"); window.location.href = "/laboratorios";</script>`);
    } else {
        res.send(`<script>alert("Erro ao salvar laboratório."); window.history.back();</script>`);
    }
});

app.post('/laboratorios/:id_lab/upload', verifyLogin, checkTipo(['admin']), upload.array('fotos', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.send(`<script>alert("Nenhum arquivo enviado."); window.history.back();</script>`);
    }

    try {
        const formData = new FormData();
        
        req.files.forEach(file => {
            const blob = new Blob([file.buffer], { type: file.mimetype });
            formData.append('fotos', blob, file.originalname);
        });

        // Envia para a API (que vai salvar no disco protegido)
        const response = await fetch(`${API_URL}/laboratorios/${req.params.id_lab}/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            res.redirect(`/laboratorios/${req.params.id_lab}`);
        } else {
            res.send(`<script>alert("Erro na API ao salvar imagens."); window.history.back();</script>`);
        }
    } catch (err) {
        console.error("Erro no proxy de upload:", err);
        res.send(`<script>alert("Erro interno de upload."); window.history.back();</script>`);
    }
});

app.get('/datas/fotos/:id_lab/:filename', async (req, res) => {
    try {
        const { id_lab, filename } = req.params;
        // URL da API (Remove o /api do final de API_URL se necessário, ou ajusta o path)
        // API_URL = http://localhost:3001/api
        const response = await fetch(`${API_URL}/fotos/${id_lab}/${filename}`);
        
        if (!response.ok) return res.status(404).send('Imagem não encontrada');
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const type = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', type);
        res.send(buffer);

    } catch (error) {
        console.error("Erro proxy imagem:", error);
        res.status(500).send('Erro ao buscar imagem');
    }
});

app.post('/laboratorios/:id_lab/status', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const { status } = req.body;
    const response = await postData(`/laboratorios/${id_lab}/status`, { status }, 'PUT');
    const result = await response.json();
    res.json(result);
});

app.post('/laboratorios/:id_lab/dispositivos/:id_disp/status', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab, id_disp } = req.params;
    const { status } = req.body;
    const response = await postData(`/laboratorios/${id_lab}/dispositivos/${id_disp}/status`, { status }, 'PUT');
    const result = await response.json();
    res.json(result);
});

// ADICIONAR DISPOSITIVOS
app.post('/laboratorios/:id_lab/dispositivos', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const response = await postData(`/laboratorios/${id_lab}/dispositivos`, req.body);
    
    if (response.ok) res.redirect(`/laboratorios/${id_lab}`);
    else res.send(`<script>alert("Erro ao adicionar dispositivo."); window.history.back();</script>`);
});

// DELETAR DISPOSITIVOS
app.post('/laboratorios/:id_lab/dispositivos/:id_dispositivo/delete', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab, id_dispositivo } = req.params;
    const response = await postData(`/laboratorios/${id_lab}/dispositivos/${id_dispositivo}`, {}, 'DELETE');

    if (response.ok) res.redirect(`/laboratorios/${id_lab}`);
    else res.send(`<script>alert("Erro ao excluir dispositivo."); window.history.back();</script>`);
});

// TOPOLOGIA
app.post('/laboratorios/:id_lab/salvar_topologia', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const response = await postData(`/laboratorios/${id_lab}/topologia`, req.body);
    const result = await response.json();
    res.json(result);
});

// Importar CSV
app.post('/laboratorios/:id_lab/importar', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const response = await postData(`/laboratorios/${id_lab}/importar`, req.body);
    const result = await response.json();
    res.json(result);
});

// RESERVAS
app.get('/cadastro/reserva', verifyLogin, checkTipo(['admin', 'professor']), async(req, res) => {
    const { lab, data } = req.query; 
    const laboratorios = await getData('/laboratorios');
    const users = await getData('/usuarios');
    const loggedUser = users.find(u => String(u.id) === String(req.user.id));

    res.render('cadastro_reserva', { 
        laboratorios: laboratorios || [],
        selectedLab: lab || '',
        selectedDate: data || '',
        userNome: loggedUser ? loggedUser.nome : '',
        userMatricula: loggedUser ? loggedUser.matricula : ''
    });
});

app.post('/reservas/:id/delete', verifyLogin, checkTipo(['admin', 'professor']), async (req, res) => {
    const response = await postData(`/reservas/${req.params.id}`, {}, 'DELETE');

    if (response.ok) {
        // Redireciona de volta para a página de onde veio (se possível) ou para minhas reservas
        res.send(`<script>alert("Reserva removida com sucesso!"); window.location.href = document.referrer || '/minhasreservas';</script>`);
    } else {
        res.send(`<script>alert("Erro ao remover a reserva."); window.history.back();</script>`);
    }
});

app.post('/cadastro/reserva', verifyLogin, checkTipo(['admin', 'professor']), async (req, res) => {
    // Validação básica de data antes de enviar para API
    if (new Date(req.body.data_inicio) >= new Date(req.body.data_fim)) {
        return res.send(`<script>alert("Erro: A data de término deve ser depois do início."); window.history.back();</script>`);
    }

    const response = await postData('/reservas', req.body);

    if (response.ok) {
        res.send(`<script>alert("Reserva confirmada!"); window.location.href = "/minhasreservas";</script>`);
    } else if (response.status === 409) {
        const errorData = await response.json();
        res.send(`<script>alert("ERRO: Já existe uma reserva (Responsável: ${errorData.responsavel})."); window.history.back();</script>`);
    } else {
        res.send(`<script>alert("Erro ao processar a reserva."); window.history.back();</script>`);
    }
});

app.get('/minhasreservas', verifyLogin, checkTipo(['admin', 'professor']), async (req, res) => {
    const historico = await getData('/reservas');
    const minhas = historico ? historico.filter(r => String(r.id_servidor) === String(req.user.matricula)) : [];

    const agora = new Date();
    const next = minhas.filter(r => new Date(r.data_inicio) >= agora);
    const last = minhas.filter(r => new Date(r.data_fim) < agora);

    res.render('minhasreservas', { proximas: next, passadas: last });
});

// AVISOS
app.get('/cadastro/avisos', verifyLogin, checkTipo(['admin']), (req, res) => res.render('cadastro_avisos', { aviso: null }));

app.get('/avisos/editar/:id', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const aviso = await getData(`/avisos/${req.params.id}`);
    if (!aviso) return res.send(`<script>alert("Aviso não encontrado."); window.history.back();</script>`);
    
    res.render('cadastro_avisos', { aviso: aviso });
});

app.post('/cadastro/avisos', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { labs } = req.body;
    let labsArray = [];
    if (labs) labsArray = labs.split(',').map(l => l.trim()).filter(l => l !== "");
    
    // Ajusta o body para enviar array
    const payload = { ...req.body, labs: labsArray };

    const response = await postData('/avisos', payload);
    
    if (response.ok) res.send(`<script>alert("Aviso cadastrado!"); window.location.href = "/";</script>`);
    else res.send(`<script>alert("Erro ao salvar aviso."); window.history.back();</script>`);
});

app.post('/avisos/editar/:id', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { labs } = req.body;
    let labsArray = [];
    if (labs) labsArray = labs.split(',').map(l => l.trim()).filter(l => l !== "");
    
    const payload = { ...req.body, labs: labsArray };
    
    const response = await postData(`/avisos/${req.params.id}`, payload, 'PUT');
    
    if (response.ok) res.send(`<script>alert("Aviso atualizado com sucesso!"); window.location.href = document.referrer || "/";</script>`);
    else res.send(`<script>alert("Erro ao atualizar aviso."); window.history.back();</script>`);
});

app.post('/avisos/delete/:id', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const response = await postData(`/avisos/${req.params.id}`, {}, 'DELETE');

    if (response.ok) {
        res.send(`<script>alert("Aviso excluído com sucesso!"); window.location.href = document.referrer || '/';</script>`);
    } else {
        res.send(`<script>alert("Erro ao excluir o aviso."); window.history.back();</script>`);
    }
});

app.get('/laboratorios/:id_lab/avisos', verifyLogin, async (req, res) => {
    const avisos = await getData('/avisos');
    const id = req.params.id_lab;
    const agora = new Date();

    const filtrados = avisos ? avisos.filter(aviso => {
        const filtrolab = Array.isArray(aviso.labs) && aviso.labs.includes(id);
        const data_fim = aviso.dataFim ? new Date(aviso.dataFim) : null;
        return filtrolab && (!data_fim || data_fim >= agora);
    }) : [];

    res.render('avisos', { avisos: filtrados, user: req.user });
});

// CHAMADOS
app.get('/chamados', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const chamados = await getData('/chamados');
    res.render('chamados', { listaChamados: chamados || [] });
});

app.post('/chamados/anotar', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_chamado, anotacoes, acao } = req.body;
    
    // Usa PUT na API
    const response = await postData(`/chamados/${id_chamado}`, { anotacoes, acao }, 'PUT');

    if (response.ok) res.redirect('/chamados');
    else res.send(`<script>alert("Erro ao atualizar chamado."); window.history.back();</script>`);
});

app.get('/laboratorios/:id_lab/report/:id_dispositivo', verifyLogin, (req, res) => {
    res.render('cadastro_report', { id_dispositivo: req.params.id_dispositivo, id_lab: req.params.id_lab });
});

app.post('/laboratorios/:id_lab/report/:id_dispositivo', verifyLogin, async (req, res) => {
    const { id_lab, id_dispositivo } = req.params;
    
    const payload = {
        ...req.body,
        id_lab,
        id_dispositivo,
        matricula_usuario: req.user.matricula
    };

    const response = await postData('/chamados', payload);

    if (response.ok) {
        res.send(`<script>alert("Problema reportado com sucesso!"); window.location.href = "/laboratorios";</script>`);
    } else {
        res.send(`<script>alert("Erro ao salvar o report."); window.history.back();</script>`);
    }
});

app.listen(PORT, () => {
  console.log(`Servidor Web SIGLAB rodando na porta ${PORT}`);
});