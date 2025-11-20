const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001; 

app.use(cors()); // diz para o navegador que essa api é segura
app.use(express.json()); // para o express entender o json do body

app.get('/api/laboratorios', (req, res) => {
  const labsPath = path.join(__dirname, 'data', 'laboratorios.json');

  fs.readFile(labsPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Erro ao ler o arquivo de dados.');
    }
    res.json(JSON.parse(data));
  });
});

app.get('/api/laboratorios/:id', (req, res) => {
  const labsPath = path.join(__dirname, 'data', 'laboratorios.json');
  const idBuscado = req.params.id;

  fs.readFile(labsPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Erro ao ler o arquivo de dados.');
    }

    try {
      const laboratorios = JSON.parse(data);
      const laboratorioEncontrado = laboratorios.find(lab => lab.id === idBuscado);

      if (!laboratorioEncontrado) {
        return res.status(404).send('Laboratório não encontrado.');
      }
      res.json(laboratorioEncontrado);

    } catch (parseErr) {
      return res.status(500).send('Erro ao processar o arquivo de dados.');
    }
  });
});

app.get('/api/historico/:tipo', (req, res) => {
  const tipo = req.params.tipo;
  if(tipo === "usuarios"){
    const histPath = path.join(__dirname, 'data', 'hist_users.json');
    fs.readFile(histPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Erro ao ler o arquivo de dados.');
      }
      res.json(JSON.parse(data));
    });

  }else if (tipo === "reservas"){
    const histPath = path.join(__dirname, 'data', 'reservas.json');

    fs.readFile(histPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Erro ao ler o arquivo de dados.');
      }
      res.json(JSON.parse(data));
    });

  }else{
    return res.status(404).send('Página não encontrada.');
  }
});

app.get('/api/avisos', (req, res) => {
  const avisos = path.join(__dirname, 'data', 'avisos.json');

  fs.readFile(avisos, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Erro ao ler o arquivo de dados.');
    }
    res.json(JSON.parse(data));
  });
});

app.post('/api/avisos', (req, res) => {
  console.log('Recebido no /api/avisos:', req.body);
  const novoAviso = req.body;
  const avisosPath = path.join(__dirname, 'data', 'avisos.json');

  if (!novoAviso.titulo || !novoAviso.mensagem || !novoAviso.tipo || !novoAviso.prioridade || !novoAviso.dataInicio) {
    return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });    
  }

  fs.readFile(avisosPath, 'utf8', (err, data) => {
    if (err) {
      // se o arquivo não existir ou der erro, começamos um novo
      if (err.code === 'ENOENT') {
        console.log('Arquivo não encontrado, criando novo...');
        data = '[]';
      } else {
          console.error('Erro ao ler arquivo:', err);
          return res.status(500).send('Erro interno ao ler dados.');
      }
    }
      
    let avisos = JSON.parse(data);

    try {
      avisos = JSON.parse(data);
      if (!Array.isArray(avisos)) {
        avisos = [];
      }
    } catch (parseErr) {
        avisos = [];
    }

    novoAviso.id = Date.now(); 
    novoAviso.data_publicado = new Date().toISOString();
    avisos.push(novoAviso);

    fs.writeFile(avisosPath, JSON.stringify(avisos, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Erro ao salvar arquivo:', writeErr);
        return res.status(500).send('Erro interno ao salvar dados.');
      }

      console.log('Aviso salvo com sucesso!');
      res.status(201).json({ message: 'Aviso criado com sucesso!', data: novoAviso });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor API rodando na porta ${PORT}`);
});