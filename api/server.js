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
  const idBuscado = parseInt(req.params.id);

  if (isNaN(idBuscado)) {
    return res.status(400).send('ID inválido.');
  }

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

app.listen(PORT, () => {
  console.log(`Servidor API rodando na porta ${PORT}`);
});