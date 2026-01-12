const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3001; 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FUNÇÕES AUXILIARES
const readData = (filename, res) => {
    const filePath = path.join(__dirname, 'data', filename);
    try {
        if (!fs.existsSync(filePath)) return []; 
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Erro ao ler ${filename}:`, err);
        if (res) res.status(500).send('Erro interno ao ler dados.');
        return null;
    }
};

const writeData = (filename, data, res) => {
    const filePath = path.join(__dirname, 'data', filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Erro ao salvar ${filename}:`, err);
        if (res) res.status(500).send('Erro interno ao salvar dados.');
        return false;
    }
};

const storageFotos = multer.diskStorage({
    destination: function (req, file, cb) {
        // Salva em data/fotos/{id_lab}
        const idLab = req.params.id;
        const dir = path.join(__dirname, 'data', 'fotos', idLab);
        
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const uploadFotos = multer({ storage: storageFotos });

// USUÁRIOS
app.get('/api/usuarios', (req, res) => {
    const users = readData('usuarios.json', res);
    if (users) res.json(users);
});

app.post('/api/usuarios', (req, res) => {
    const users = readData('usuarios.json', res);
    if (!users) return;

    const novoUsuario = req.body;
    
    if (users.find(u => u.email === novoUsuario.email)) {
        return res.status(409).json({ message: "Email já cadastrado." });
    }

    novoUsuario.id = users.length + 1;
    users.push(novoUsuario);

    if (writeData('usuarios.json', users, res)) {
        res.status(201).json(novoUsuario);
    }
});

// LABORATÓRIOS
app.get('/api/laboratorios', (req, res) => {
    const labs = readData('laboratorios.json', res);
    if (labs) res.json(labs);
});

app.get('/api/laboratorios/:id', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const lab = labs.find(l => l.id === req.params.id);
    if (!lab) return res.status(404).send('Laboratório não encontrado.');
    res.json(lab);
});

app.post('/api/laboratorios', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const novoLab = req.body;

    const lastId = labs.length > 0 ? parseInt(labs[labs.length - 1].id) : 100;
    novoLab.id = String(lastId + 1);
    novoLab.dispositivos = [];
    novoLab.imagens = []; 

    labs.push(novoLab);
    if (writeData('laboratorios.json', labs, res)) {
        res.status(201).json(novoLab);
    }
});

app.put('/api/laboratorios/:id/status', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const lab = labs.find(l => l.id === req.params.id);
    if (!lab) return res.status(404).json({ message: 'Lab não encontrado' });

    lab.status = req.body.status;
    
    if (writeData('laboratorios.json', labs, res)) {
        res.json({ success: true, newStatus: lab.status });
    }
});

app.put('/api/laboratorios/:id/dispositivos/:id_disp/status', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const labIndex = labs.findIndex(l => l.id === req.params.id);

    if (labIndex === -1) return res.status(404).json({ message: 'Lab não encontrado' });

    const disp = labs[labIndex].dispositivos.find(d => d.id_dispositivo === req.params.id_disp);
    if (!disp) return res.status(404).json({ message: 'Dispositivo não encontrado' });

    disp.status = req.body.status;

    if (writeData('laboratorios.json', labs, res)) {
        res.json({ success: true, id_dispositivo: disp.id_dispositivo, newStatus: disp.status });
    }
});

// UPLOADS FOTOS LABORATÓRIOS

app.post('/api/laboratorios/:id/upload', uploadFotos.array('fotos', 10), (req, res) => {
    const labs = readData('laboratorios.json', res);
    const labIndex = labs.findIndex(l => l.id === req.params.id);

    if (labIndex === -1) return res.status(404).json({ message: 'Lab não encontrado' });

    // Pega os nomes dos arquivos salvos pelo Multer
    const filenames = req.files.map(file => file.filename);

    if (!labs[labIndex].imagens) labs[labIndex].imagens = [];
    labs[labIndex].imagens.push(...filenames);

    if (writeData('laboratorios.json', labs, res)) {
        res.status(200).json({ message: "Fotos salvas na API com sucesso" });
    }
});

app.get('/api/fotos/:id/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'fotos', req.params.id, req.params.filename);
    
    // Verifica se arquivo existe e envia
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Imagem não encontrada');
    }
});

// Gerenciar Dispositivos
app.post('/api/laboratorios/:id/dispositivos', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const labIndex = labs.findIndex(l => l.id === req.params.id);

    if (labIndex === -1) return res.status(404).send('Lab não encontrado');

    const dispositivo = req.body;
    dispositivo.id_dispositivo = `${req.params.id}-${Date.now()}`;
    
    if (!labs[labIndex].dispositivos) labs[labIndex].dispositivos = [];
    labs[labIndex].dispositivos.push(dispositivo);

    if (writeData('laboratorios.json', labs, res)) {
        res.status(201).json({ message: "Dispositivo adicionado" });
    }
});

app.delete('/api/laboratorios/:id/dispositivos/:id_disp', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const labIndex = labs.findIndex(l => l.id === req.params.id);
    
    if (labIndex === -1) return res.status(404).send('Lab não encontrado');

    const dispIndex = labs[labIndex].dispositivos.findIndex(d => d.id_dispositivo === req.params.id_disp);
    if (dispIndex === -1) return res.status(404).send('Dispositivo não encontrado');

    labs[labIndex].dispositivos.splice(dispIndex, 1);

    if (writeData('laboratorios.json', labs, res)) {
        res.status(200).json({ message: "Dispositivo removido" });
    }
});

app.post('/api/laboratorios/:id/topologia', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const lab = labs.find(l => l.id === req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: "Lab não encontrado" });

    const { posicoes } = req.body;
    posicoes.forEach(pos => {
        const disp = lab.dispositivos.find(d => d.id_dispositivo === pos.id_dispositivo);
        if (disp) {
            disp.posicao = { row: parseInt(pos.row), col: parseInt(pos.col) };
        }
    });

    if (writeData('laboratorios.json', labs, res)) {
        res.json({ success: true });
    }
});

app.post('/api/laboratorios/:id/importar', (req, res) => {
    const labs = readData('laboratorios.json', res);
    const labIndex = labs.findIndex(l => l.id === req.params.id);
    if (labIndex === -1) return res.status(404).json({ success: false });

    const { dispositivos } = req.body;
    let count = 0;
    
    if (!labs[labIndex].dispositivos) labs[labIndex].dispositivos = [];

    dispositivos.forEach(d => {
        const novoId = `${req.params.id}-${Date.now()}-${count++}`;
        labs[labIndex].dispositivos.push({
            id_dispositivo: novoId,
            nome: d.nome,
            tipo: d.tipo ? d.tipo.toLowerCase() : 'outros',
            status: d.status ? d.status.toLowerCase() : 'livre'
        });
    });

    if (writeData('laboratorios.json', labs, res)) {
        res.json({ success: true, count });
    }
});

// RESERVAS
app.get('/api/reservas', (req, res) => {
    const reservas = readData('reservas.json', res);
    if (reservas) res.json(reservas);
});

app.post('/api/reservas', (req, res) => {
    const reservas = readData('reservas.json', res);
    const novaReserva = req.body;
    const { id_lab, data_inicio, data_fim } = novaReserva;

    const inicio = new Date(data_inicio);
    const fim = new Date(data_fim);

    const conflito = reservas.find(r => {
        if (r.id_lab !== id_lab) return false;
        const rInicio = new Date(r.data_inicio);
        const rFim = new Date(r.data_fim);
        return (inicio < rFim && fim > rInicio);
    });

    if (conflito) {
        return res.status(409).json({ message: "Conflito de horário", responsavel: conflito.name });
    }

    const novoId = reservas.length > 0 ? parseInt(reservas[reservas.length - 1].id) + 1 : 1;
    novaReserva.id = String(novoId);
    
    reservas.push(novaReserva);

    if (writeData('reservas.json', reservas, res)) {
        res.status(201).json(novaReserva);
    }
});

app.delete('/api/reservas/:id', (req, res) => {
    const reservas = readData('reservas.json', res);
    if (!reservas) return res.status(500).send('Erro ao ler banco de dados');

    const index = reservas.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Reserva não encontrada." });

    reservas.splice(index, 1);

    if (writeData('reservas.json', reservas, res)) {
        res.status(200).json({ message: "Reserva deletada com sucesso." });
    }
});

// HISTÓRICO DE ACESSOS
app.get('/api/acessos', (req, res) => {
    const acessos = readData('acessos.json', res);
    res.json(acessos || []);
});

// AVISOS
app.get('/api/avisos', (req, res) => {
    const avisos = readData('avisos.json', res);
    res.json(avisos || []);
});

app.get('/api/avisos/:id', (req, res) => {
    const avisos = readData('avisos.json', res);
    const aviso = avisos.find(a => String(a.id) === req.params.id);
    if (!aviso) return res.status(404).json({ message: "Aviso não encontrado" });
    res.json(aviso);
});

app.post('/api/avisos', (req, res) => {
    const avisos = readData('avisos.json', res);
    const novoAviso = req.body;
    
    novoAviso.id = Date.now();
    novoAviso.data_publicado = new Date().toISOString();
    
    avisos.push(novoAviso);
    if (writeData('avisos.json', avisos, res)) {
        res.status(201).json(novoAviso);
    }
});

app.put('/api/avisos/:id', (req, res) => {
    const avisos = readData('avisos.json', res);
    const index = avisos.findIndex(a => String(a.id) === req.params.id);
    
    if (index === -1) return res.status(404).json({ message: "Aviso não encontrado" });

    const atualizado = { ...avisos[index], ...req.body };
    avisos[index] = atualizado;

    if (writeData('avisos.json', avisos, res)) {
        res.json(atualizado);
    }
});

app.delete('/api/avisos/:id', (req, res) => {
    const avisos = readData('avisos.json', res);
    const index = avisos.findIndex(a => String(a.id) === req.params.id);
    
    if (index === -1) return res.status(404).json({ message: "Aviso não encontrado" });

    avisos.splice(index, 1);

    if (writeData('avisos.json', avisos, res)) {
        res.json({ message: "Aviso removido" });
    }
});

// CHAMADOS
app.get('/api/chamados', (req, res) => {
    const chamados = readData('chamados.json', res);
    res.json(chamados || []);
});

app.post('/api/chamados', (req, res) => {
    const chamados = readData('chamados.json', res);
    const novoChamado = req.body;
    
    novoChamado.id = `ticket-${Date.now()}`;
    novoChamado.status = "aberto";
    novoChamado.data_abertura = new Date().toISOString();

    chamados.push(novoChamado);
    if (writeData('chamados.json', chamados, res)) {
        res.status(201).json(novoChamado);
    }
});

app.put('/api/chamados/:id', (req, res) => {
    const chamados = readData('chamados.json', res);
    const index = chamados.findIndex(c => c.id === req.params.id);

    if (index === -1) return res.status(404).send('Chamado não encontrado');

    const { anotacoes, acao } = req.body;
    
    if (anotacoes) chamados[index].anotacoes = anotacoes;
    
    if (acao === 'resolver') {
        chamados[index].status = 'resolvido';
        chamados[index].data_fechamento = new Date().toISOString();
    } else if (acao === 'reabrir') {
        chamados[index].status = 'aberto';
        chamados[index].data_fechamento = null;
    }

    if (writeData('chamados.json', chamados, res)) {
        res.json(chamados[index]);
    }
});

app.listen(PORT, () => {
  console.log(`Servidor API rodando na porta ${PORT}`);
});