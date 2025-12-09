const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000; 
const { verifyLogin, blacklist } = require('./verify.js');
const { checkTipo } = require('./permition.js');

require("dotenv-safe").config()

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 
app.set('view engine', 'ejs');
app.set('views', './views'); 

// USUÁRIO
app.get('/login', async (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {

    var sha512 = (pwd, key) => {
        var hash = crypto.createHmac('sha512', key)
        hash.update(pwd)
        return hash.digest('hex') 
    }

    var email = req.body.email
    var password = sha512(req.body.password, process.env.SECRET_USERS)

    if (email && password) {
        var users = JSON.parse(await fs.readFile(__dirname + '/data/usuarios.json'))
        var userloc = users.find((item) => {
            return (item.email == email && item.password == password)
        })

        if (userloc) {
            const token = jwt.sign(
                { id: userloc.id, tipo: userloc.tipo, matricula: userloc.matricula },
                process.env.SECRET,
                { expiresIn: 3600 }
            )
            res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });

            return res.redirect('/');
        }
    }
    console.log('Erro no login')
    return res.send(`
      <script>
          alert('Usuário e/ou senha inválidos');
          window.history.back();
      </script>
  `);
});

app.get('/logout', verifyLogin, (req, res) => {
    const token = req.cookies.token;
    
    if (token) {
        blacklist.push(token); 
    }
    
    res.clearCookie('token');
    res.redirect('/login');
});

app.get('/cadastro/usuario', verifyLogin, checkTipo(['admin']), async (req, res) => {
  res.render('cadastro_user');
});

app.post('/cadastro/usuario', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { nome, email, tipo, matricula } = req.body;

    if (!nome || !email || !matricula) {
        return res.send(`
            <script>
                alert("Por favor, preencha todos os campos obrigatórios.");
                window.history.back();
            </script>
        `);
    }

    const filePath = path.join(__dirname, 'data', 'usuarios.json');

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const users = JSON.parse(data);

        const emailExiste = users.find(user => user.email === email);
        if (emailExiste) {
            return res.send(`
                <script>
                    alert("Erro: Este email já está cadastrado.");
                    window.history.back();
                </script>
            `);
        }

        const criarHash = (pwd) => {
            const segredo = process.env.SECRET_USERS;
            const hash = crypto.createHmac('sha512', segredo);
            hash.update(pwd);
            return hash.digest('hex');
        };

        const novoUsuario = {
            id: users.length + 1,
            nome: nome,
            email: email,
            tipo: tipo,
            matricula: matricula,
            password: criarHash(matricula) 
        };

        users.push(novoUsuario);

        fs.writeFile(filePath, JSON.stringify(users, null, 2));

        console.log("Novo usuário cadastrado:", novoUsuario.nome);
        res.send(`
            <script>
                alert("Usuário cadastrado com sucesso!");
                window.location.href = "/";
            </script>
        `);

    } catch (erro) {
        console.error(erro);
        res.status(500).send(`
            <script>
                alert("Erro interno ao salvar usuário.");
                window.history.back();
            </script>
        `);
    }
});

// ADMIN
app.get('/', verifyLogin, checkTipo(['admin']), async (req, res) => {
  res.render('index');
});

// HISTORICO
app.get('/historico', verifyLogin, checkTipo(['admin']), (req, res) => {
    res.redirect('/historico/geral');
});

app.get('/historico/:id_lab', verifyLogin, checkTipo(['admin']), async (req, res) => {
  try {
    const id = req.params.id_lab;
    const historico_reservasPath = path.join(__dirname, 'data', 'reservas.json');
    const historico_userPath = path.join(__dirname, 'data', 'acessos.json');
    const labPath = path.join(__dirname, 'data', 'laboratorios.json');

    const dataReservas = await fs.readFile(historico_reservasPath, 'utf8');
    const dataUsers = await fs.readFile(historico_userPath, 'utf8');
    const dataLabs = await fs.readFile(labPath, 'utf8');

    let historico_reservas = JSON.parse(dataReservas);
    let historico_user = JSON.parse(dataUsers);
    const laboratorios = JSON.parse(dataLabs);

    if (id !== 'geral') {
        historico_reservas = historico_reservas.filter(reserva => reserva.id_lab === id);
        historico_user = historico_user.filter(user => user.id_lab === id);
    }

    const agora = new Date();

    const next_reservas = historico_reservas.filter(reserva => {
      const data_reserva = new Date(reserva.data_inicio);
      return data_reserva >= agora;
    });

    const last_reservas = historico_reservas.filter(reserva => {
      const data_reserva = new Date(reserva.data_fim || reserva.data_inicio);
      return data_reserva < agora;
    });

    res.render('historicos', { proximas : next_reservas, passadas: last_reservas, usuarios : historico_user, lab : laboratorios, lab_nome: id === 'geral' ? 'Geral' : (laboratorios.find(lab => lab.id === id)?.nome || '') });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

// DISPONIBILIDADE 
app.get('/disponibilidade/:id_lab', verifyLogin, async (req, res) => {
  var id = req.params.id_lab;
  const reservasPath = path.join(__dirname, 'data', 'reservas.json');
  const labPath = path.join(__dirname, 'data', 'laboratorios.json');

  try {
    const data = await fs.readFile(reservasPath, 'utf8');
    const todasReservas = JSON.parse(data);

    const labData = await fs.readFile(labPath, 'utf8');
    const laboratorios = JSON.parse(labData);

    if (id === 'geral') {
        res.render('disponibilidade', { 
            reservas: todasReservas, 
            lab_id: 'geral',
            lab_nome: 'Geral'
        });

    } else {
        const reservas_lab = todasReservas.filter(reserva => reserva.id_lab === id);
        const lab = laboratorios.find(lab => lab.id === id);
        res.render('disponibilidade', { 
            reservas: reservas_lab, 
            lab_id: lab.id,
            lab_nome: lab.nome
        });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

// LABORATORIOS 
app.get('/laboratorios', verifyLogin, async (req, res) => {
  try {
    /* const apiResponse = await fetch('http://localhost:3001/api/laboratorios');
    const laboratorios = await apiResponse.json(); */

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    const data = await fs.readFile(labsPath, 'utf8');

    const laboratorios = JSON.parse(data);

    res.render('lista_laboratorios', { laboratorios: laboratorios });

  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.get('/laboratorios/:id_lab', verifyLogin, async (req, res) => {
  var id = req.params.id_lab;
  try {
    /* var url = `http://localhost:3001/api/laboratorios/${id}`;
    console.log(url);
    const apiResponse = await fetch(url);
    const lab = await apiResponse.json() */

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    const data = await fs.readFile(labsPath, 'utf8');

    const laboratorios = JSON.parse(data);

    const lab = laboratorios.find(lab => lab.id === id);

    if (!lab) {
        return res.status(404).send('Laboratório não encontrado.');
    }

    res.render('laboratorio', { lab : lab, user: req.user });
  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.get('/cadastro/laboratorios', verifyLogin, checkTipo(['admin']), async (req, res) => {
  res.render('cadastro_lab');
});

app.post('/cadastro/laboratorios', verifyLogin, checkTipo(['admin']), async (req, res) => {
    
    const { nome, localizacao, capacidade, status, descricao } = req.body;

    if (!nome || !localizacao || !capacidade) {
        return res.send(`
            <script>
                alert("Por favor, preencha todos os campos obrigatórios (Nome, Localização e Capacidade).");
                window.history.back();
            </script>
        `);
    }

    const filePath = path.join(__dirname, 'data', 'laboratorios.json');

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const labs = JSON.parse(data);

        const lastId = labs.length > 0 ? parseInt(labs[labs.length - 1].id) : 100;
        const novoId = String(lastId + 1);

        const novoLab = {
            id: novoId,
            nome: nome,
            status: status || 'Disponível',
            localizacao: localizacao,
            capacidade: parseInt(capacidade),
            descricao: descricao || '',
            dispositivos: []
        };

        labs.push(novoLab);

        await fs.writeFile(filePath, JSON.stringify(labs, null, 2));

        console.log("Novo laboratório cadastrado:", novoLab.nome);
        res.send(`
            <script>
                alert("Laboratório ${novoId} cadastrado com sucesso!");
                window.location.href = "/laboratorios"; // ou "/" se preferir
            </script>
        `);

    } catch (err) {
        console.error(err);
        res.status(500).send(`
            <script>
                alert("Erro interno ao salvar o laboratório.");
                window.history.back();
            </script>
        `);
    }
});

app.post('/laboratorios/:id_lab/dispositivos', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const { nome, tipo, status } = req.body;

    if (!nome || !tipo || !status) {
        return res.send(`
            <script>
                alert("Por favor, preencha todos os campos do dispositivo.");
                window.history.back();
            </script>
        `);
    }

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    try {
        const data = await fs.readFile(labsPath, 'utf-8');
        const laboratorios = JSON.parse(data);

        const labIndex = laboratorios.findIndex(l => l.id === id_lab);

        if (labIndex === -1) {
            return res.status(404).send("Laboratório não encontrado");
        }

        const novoIdDispositivo = `${id_lab}-${Date.now()}`;

        const novoDispositivo = {
            id_dispositivo: novoIdDispositivo,
            nome: nome,
            tipo: tipo,
            status: status
        };

        if (!laboratorios[labIndex].dispositivos) {
            laboratorios[labIndex].dispositivos = [];
        }

        laboratorios[labIndex].dispositivos.push(novoDispositivo);

        await fs.writeFile(labsPath, JSON.stringify(laboratorios, null, 2));

        res.redirect(`/laboratorios/${id_lab}`);

    } catch (err) {
        console.error("Erro ao salvar dispositivo:", err);
        res.status(500).send(`
            <script>
                alert("Erro interno ao salvar dispositivo.");
                window.history.back();
            </script>
        `);
    }
});

app.post('/laboratorios/:id_lab/dispositivos/:id_dispositivo/delete', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab, id_dispositivo } = req.params;
    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    try {
        const data = await fs.readFile(labsPath, 'utf-8');
        const laboratorios = JSON.parse(data);

        const labIndex = laboratorios.findIndex(l => l.id === id_lab);

        if (labIndex === -1) {
            return res.status(404).send("Laboratório não encontrado");
        }

        const dispIndex = laboratorios[labIndex].dispositivos.findIndex(d => d.id_dispositivo === id_dispositivo);

        if (dispIndex === -1) {
            return res.status(404).send("Dispositivo não encontrado");
        }

        // Remove o dispositivo do array
        laboratorios[labIndex].dispositivos.splice(dispIndex, 1);

        await fs.writeFile(labsPath, JSON.stringify(laboratorios, null, 2));

        res.redirect(`/laboratorios/${id_lab}`);

    } catch (err) {
        console.error("Erro ao excluir dispositivo:", err);
        res.status(500).send(`
            <script>
                alert("Erro interno ao excluir dispositivo.");
                window.history.back();
            </script>
        `);
    }
});

app.post('/laboratorios/:id_lab/salvar_topologia', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const { posicoes } = req.body; // Array de { id_dispositivo, row, col }

    if (!posicoes || !Array.isArray(posicoes)) {
        return res.status(400).json({ success: false, message: "Dados de topologia inválidos." });
    }

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    try {
        const data = await fs.readFile(labsPath, 'utf-8');
        const laboratorios = JSON.parse(data);

        const labIndex = laboratorios.findIndex(l => l.id === id_lab);

        if (labIndex === -1) {
            return res.status(404).json({ success: false, message: "Laboratório não encontrado." });
        }

        const lab = laboratorios[labIndex];

        // Atualizar posições
        posicoes.forEach(pos => {
            const disp = lab.dispositivos.find(d => d.id_dispositivo === pos.id_dispositivo);
            if (disp) {
                disp.posicao = {
                    row: parseInt(pos.row),
                    col: parseInt(pos.col)
                };
            }
        });

        await fs.writeFile(labsPath, JSON.stringify(laboratorios, null, 2));

        res.json({ success: true, message: "Topologia salva com sucesso!" });

    } catch (err) {
        console.error("Erro ao salvar topologia:", err);
        res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

// IMPORTAR CSV (Rota em lote)
app.post('/laboratorios/:id_lab/importar', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_lab } = req.params;
    const { dispositivos } = req.body; // Espera um array de objetos

    if (!dispositivos || !Array.isArray(dispositivos)) {
        return res.status(400).json({ success: false, message: "Dados inválidos." });
    }

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

    try {
        const data = await fs.readFile(labsPath, 'utf-8');
        const laboratorios = JSON.parse(data);

        const labIndex = laboratorios.findIndex(l => l.id === id_lab);

        if (labIndex === -1) {
            return res.status(404).json({ success: false, message: "Laboratório não encontrado." });
        }

        if (!laboratorios[labIndex].dispositivos) {
            laboratorios[labIndex].dispositivos = [];
        }

        let count = 0;
        dispositivos.forEach(d => {
            // Gera um ID único simples para cada item do CSV
            const novoId = `${id_lab}-${Date.now()}-${count++}`;
            
            laboratorios[labIndex].dispositivos.push({
                id_dispositivo: novoId,
                nome: d.nome,
                tipo: d.tipo ? d.tipo.toLowerCase() : 'outros',
                status: d.status ? d.status.toLowerCase() : 'livre'
            });
        });

        await fs.writeFile(labsPath, JSON.stringify(laboratorios, null, 2));

        res.json({ success: true, message: `${count} dispositivos importados com sucesso!` });

    } catch (err) {
        console.error("Erro na importação:", err);
        res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

// RESERVAS 
app.get('/cadastro/reserva', verifyLogin, checkTipo(['admin', 'professor']), async(req, res) => {
    const { lab, data } = req.query; 

    const labsPath = path.join(__dirname, 'data', 'laboratorios.json');
    const usersPath = path.join(__dirname, 'data', 'usuarios.json');

    try {
        // Lê os laboratórios para preencher o <select>
        const fileData = await fs.readFile(labsPath, 'utf8');
        const laboratorios = JSON.parse(fileData);

        const usersData = await fs.readFile(usersPath, 'utf8');
        const users = JSON.parse(usersData);
        const loggedUser = users.find(u => String(u.id) === String(req.user.id));

        res.render('cadastro_reserva', { 
            laboratorios: laboratorios,
            selectedLab: lab || '',     // ID do lab pré-selecionado
            selectedDate: data || '',    // Data pré-selecionada
            userNome: loggedUser ? loggedUser.nome : '',
            userMatricula: loggedUser ? loggedUser.matricula : ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar formulário.");
    }
});

app.post('/cadastro/reserva', verifyLogin, checkTipo(['admin', 'professor']), async (req, res) => {
    const { id_lab, id_servidor, name, data_inicio, data_fim, motivo } = req.body;

    if (!id_lab || !name || !data_inicio || !data_fim) {
        return res.send(`
            <script>
                alert("Preencha todos os campos obrigatórios.");
                window.history.back();
            </script>
        `);
    }

    // Validar se a data final é maior que a inicial
    const inicio = new Date(data_inicio);
    const fim = new Date(data_fim);

    if (inicio >= fim) {
        return res.send(`
            <script>
                alert("Erro: A data de término deve ser depois do início.");
                window.history.back();
            </script>
        `);
    }

    const reservasPath = path.join(__dirname, 'data', 'reservas.json');
    const usersPath = path.join(__dirname, 'data', 'usuarios.json');
        
    try {
        const data = await fs.readFile(reservasPath, 'utf-8');
        const reservas = JSON.parse(data);

        // VERIFICAÇÃO DE CONFLITO DE HORÁRIO
        // A lógica é (NovoInicio < ReservaFim) E (NovoFim > ReservaInicio)
        const conflito = reservas.find(reserva => {
            // Só verifica conflito se for no MESMO laboratório
            if (reserva.id_lab !== id_lab) return false;

            const rInicio = new Date(reserva.data_inicio);
            const rFim = new Date(reserva.data_fim);

            return (inicio < rFim && fim > rInicio);
        });

        if (conflito) {
            return res.send(`
                <script>
                    alert("ERRO: Já existe uma reserva para o Lab ${id_lab} neste horário (Responsável: ${conflito.name}).");
                    window.history.back();
                </script>
            `);
        }

        const novoId = reservas.length > 0 ? parseInt(reservas[reservas.length - 1].id) + 1 : 1;

        const novaReserva = {
            id: String(novoId),
            id_lab,
            id_servidor,
            name,
            data_inicio,
            data_fim,
            motivo: motivo || ""
        };

        reservas.push(novaReserva);

        await fs.writeFile(reservasPath, JSON.stringify(reservas, null, 2));

        const usersData = await fs.readFile(usersPath, 'utf8');
        const users = JSON.parse(usersData);
        const loggedUser = users.find(u => String(u.id) === String(req.user.id));

        res.send(`
            <script>
                alert("Reserva confirmada para o Lab ${id_lab}!");
                window.location.href = "/minhasreservas"; // Redireciona para a lista de reservas
            </script>
        `);

    } catch (err) {
        console.error(err);
        res.status(500).send(`
            <script>
                alert("Erro interno ao processar a reserva.");
                window.history.back();
            </script>
        `);
    }
});   

app.get('/minhasreservas', verifyLogin, checkTipo(['admin', 'professor']), async (req, res) => {
    var id = req.user.matricula;

    const historicoPath = path.join(__dirname, 'data', 'reservas.json');

    try {
        /*var url = `http://localhost:3001/api/historico/reservas`;
        console.log(url);
        const apiResponse = await fetch(url);
        const historico = await apiResponse.json()*/

        const data = await fs.readFile(historicoPath, 'utf8');

        historico = JSON.parse(data);
        historico = historico.filter(reserva => String(reserva.id_servidor) === String(id));

        const agora = new Date();

        const next_reservas = historico.filter(reserva => {
        const data_reserva = new Date(reserva.data_inicio);
        return data_reserva >= agora;
        });

        const last_reservas = historico.filter(reserva => {
        const data_reserva = new Date(reserva.data_fim);
        return data_reserva < agora;
        });

        res.render('minhasreservas', { proximas : next_reservas, passadas: last_reservas });
    } catch (err) {
        res.status(500).send('Erro ao buscar dados da API.');
    } 
});

// AVISOS
app.get('/cadastro/avisos', verifyLogin, checkTipo(['admin']), async (req, res) => {
  res.render('cadastro_avisos');
});

app.post('/cadastro/avisos', verifyLogin, checkTipo(['admin']), async (req, res) => {
    
    const { titulo, mensagem, tipo, prioridade, dataInicio, dataFim, labs } = req.body;

    if (!titulo || !mensagem || !tipo || !prioridade || !dataInicio) {
        return res.send(`
            <script>
                alert("Por favor, preencha todos os campos obrigatórios.");
                window.history.back();
            </script>
        `);
    }

    const filePath = path.join(__dirname, 'data', 'avisos.json');

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const avisos = JSON.parse(data);

        let labsArray = [];
        if (labs) {
            labsArray = labs.split(',').map(lab => lab.trim()).filter(l => l !== "");
        }

        const novoAviso = {
            id: Date.now(),
            titulo,
            mensagem,
            tipo,
            prioridade,
            dataInicio,
            dataFim: dataFim || null,
            labs: labsArray,
            data: new Date().toISOString()
        };

        avisos.push(novoAviso);

        await fs.writeFile(filePath, JSON.stringify(avisos, null, 2));

        res.send(`
            <script>
                alert("Aviso cadastrado com sucesso!");
                window.location.href = "/"; // Redireciona para a página de listagem
            </script>
        `);

    } catch (erro) {
        console.error(erro);
        res.status(500).send(`
            <script>
                alert("Erro interno ao salvar o aviso.");
                window.history.back();
            </script>
        `);
    }
});

app.get('/laboratorios/:id_lab/avisos', verifyLogin, async (req, res) => {
  const id = req.params.id_lab;
  try {
    /*var url = `http://localhost:3001/api/avisos`;
    console.log(url);
    const apiResponse = await fetch(url);
    const avisos = await apiResponse.json();*/

    const avisosPath = path.join(__dirname, 'data', 'avisos.json');

    const data = await fs.readFile(avisosPath, 'utf8');

    avisos = JSON.parse(data);

    const agora = new Date();
    
    const avisos_filtrados = avisos.filter(aviso => {
      const filtrolab = aviso.labs.includes(id);

      let aviso_valido = true;
      if (aviso.dataFim) {
        const data_fim = new Date(aviso.dataFim);
        aviso_valido = data_fim >= agora;
      }

      return filtrolab && aviso_valido;
    })

    res.render('avisos', { avisos : avisos_filtrados });
  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

// CHAMADOS
app.get('/chamados', verifyLogin, checkTipo(['admin']), async (req, res) => {
    
    const chamadosPath = path.join(__dirname, 'data', 'chamados.json');
    const data = await fs.readFile(chamadosPath, 'utf-8');
    const chamados = JSON.parse(data);

    res.render('chamados', { listaChamados: chamados });
});

app.post('/chamados/anotar', verifyLogin, checkTipo(['admin']), async (req, res) => {
    const { id_chamado, anotacoes, acao } = req.body;

    const chamadosPath = path.join(__dirname, 'data', 'chamados.json');

    try {
        const data = await fs.readFile(chamadosPath, 'utf-8');
        const chamados = JSON.parse(data);

        // Encontra o chamado pelo ID
        const index = chamados.findIndex(c => c.id === id_chamado);

        if (index === -1) {
             return res.send(`
                <script>
                    alert("Chamado não encontrado.");
                    window.history.back();
                </script>
            `);
        }

        // Atualiza anotações
        chamados[index].anotacoes = anotacoes;

        // Lógica de Resolver ou Reabrir
        if (acao === 'resolver') {
            chamados[index].status = 'resolvido';
            chamados[index].data_fechamento = new Date().toISOString();
        } else if (acao === 'reabrir') {
            chamados[index].status = 'aberto';
            // Se quiser limpar a data de fechamento ao reabrir:
            chamados[index].data_fechamento = null;
            // Se quiser registrar quando foi reaberto, poderia criar um log, mas aqui só resetamos o status
        }

        await fs.writeFile(chamadosPath, JSON.stringify(chamados, null, 2));

        res.redirect('/chamados');

    } catch (err) {
        console.error(err);
        res.status(500).send(`
            <script>
                alert("Erro ao atualizar chamado.");
                window.history.back();
            </script>
        `);
    }
});

app.get('/laboratorios/:id_lab/report/:id_dispositivo', verifyLogin, async(req, res) => {
  const id_dispositivo = req.params.id_dispositivo;
  const id_lab = req.params.id_lab;
  res.render('cadastro_report', { id_dispositivo : id_dispositivo, id_lab : id_lab });
});

app.post('/laboratorios/:id_lab/report/:id_dispositivo', verifyLogin, async (req, res) => {
    
    //Pegamos os IDs da URL (req.params)
    const { id_lab, id_dispositivo } = req.params;

    //Pegamos os dados digitados (req.body)
    const { titulo, tipo_problema, gravidade, descricao } = req.body;

    // Validação
    if (!titulo || !descricao) {
        return res.send(`
            <script>
                alert("Por favor, preencha o título e a descrição do problema.");
                window.history.back();
            </script>
        `);
    }

    const chamadosPath = path.join(__dirname, 'data', 'chamados.json');

    try {
        // Lendo arquivo
        const data = await fs.readFile(chamadosPath, 'utf-8');
        const chamados = JSON.parse(data);

        // Criando novo chamado
        const novoChamado = {
            id: `ticket-${Date.now()}`,
            id_lab: id_lab,
            id_dispositivo: id_dispositivo,
            matricula_usuario: req.user.matricula,
            titulo: titulo,
            tipo_problema: tipo_problema,
            gravidade: gravidade,
            descricao: descricao,
            status: "aberto",
            data_abertura: new Date().toISOString()
        };

        chamados.push(novoChamado);

        await fs.writeFile(chamadosPath, JSON.stringify(chamados, null, 2));

        res.send(`
            <script>
                alert("Problema reportado com sucesso! Ticket criado.");
                window.location.href = "/laboratorios"; 
            </script>
        `);

    } catch (err) {
        console.error(err);
        res.status(500).send(`
            <script>
                alert("Erro interno ao salvar o report.");
                window.history.back();
            </script>
        `);
    }
});

app.listen(PORT, () => {
  console.log(`Servidor Web SIGLAB rodando na porta ${PORT}`);
});