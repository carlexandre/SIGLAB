const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3001; 

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
})

app.listen(PORT, () => {
  console.log(`Servidor API rodando na porta ${PORT}`);
});