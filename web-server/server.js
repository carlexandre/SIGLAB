const express = require('express');
const fetch = require('node-fetch'); // Comunicação API
const app = express();
const PORT = 3000; 

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/login', async (req, res) => {

});

app.get('/cadastro', async (req, res) => {

});

app.get('/historico/:tipo', async (req, res) => {

});

app.get('/laboratorios', async (req, res) => {
  try {
    // 1. Chamar a API
    const apiResponse = await fetch('http://localhost:3001/api/laboratorios');
    const laboratorios = await apiResponse.json();

    // 2. Renderizar a página EJS com os dados
    res.render('lista_laboratorios', { laboratorios: laboratorios });

  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.get('/laboratorios/:id', async (req, res) => {
  var id = req.params.id;
  console.log(id);
  try {
    var url = 'http://localhost:3001/api/laboratorios/' + id;
    console.log(url);
    const apiResponse = await fetch(url);
    const lab = await apiResponse.json()

    res.render('laboratorio', { lab : lab });
  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Web SIGLAB rodando na porta ${PORT}`);
});