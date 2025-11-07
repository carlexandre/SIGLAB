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

app.get('/', async (req, res) => {
  res.render('index');
});

app.get('/historico', async (req, res) => {
  res.render('historicos')
})

app.get('/historico/:tipo', async (req, res) => {
  var tipo = req.params.tipo;
  console.log(tipo);
  try {
    var url = `http://localhost:3001/api/historico/${tipo}`;
    console.log(url);
    const apiResponse = await fetch(url);
    const historico = await apiResponse.json()

    if(tipo === "reservas"){
      const agora = new Date();

      const next_reservas = historico.filter(reserva => {
        const data_reserva = new Date(reserva.data);
        return data_reserva >= agora;
      });

      const last_reservas = historico.filter(reserva => {
        const data_reserva = new Date(reserva.data);
        return data_reserva < agora;
      });

      res.render('historico_reservas', { proximas : next_reservas, passadas: last_reservas });

    }else if(tipo === "usuarios")
    res.render('historico_user', { usuarios : historico });

  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
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

app.get('/laboratorios/:id_lab', async (req, res) => {
  var id = req.params.id_lab;
  console.log(id);
  try {
    var url = `http://localhost:3001/api/laboratorios/${id}`;
    console.log(url);
    const apiResponse = await fetch(url);
    const lab = await apiResponse.json()

    res.render('laboratorio', { lab : lab });
  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.get('/laboratorios/:id_lab/disponibilidade', async (req, res) => {
  var id = req.params.id_lab;
  console.log(id);
  try {
    var url = `http://localhost:3001/api/laboratorios/${id}`;
    console.log(url);
    const apiResponse = await fetch(url);
    const lab = await apiResponse.json()

    res.render('disponibilidade', { lab : lab });
  } catch (err) {
    res.status(500).send('Erro ao buscar dados da API.');
  }
});

app.get('/reservas/:id_user', async (req, res) => {
  var id = req.params.id_user;
  console.log(id);
  try {
    var url = `http://localhost:3001/api/historico/reservas`;
    console.log(url);
    const apiResponse = await fetch(url);
    const historico = await apiResponse.json()

    const agora = new Date();

    const next_reservas = historico.filter(reserva => {
      const data_reserva = new Date(reserva.data);
      return data_reserva >= agora;
    });

    const last_reservas = historico.filter(reserva => {
      const data_reserva = new Date(reserva.data);
      return data_reserva < agora;
    });

    res.render('minhasreservas', { proximas : next_reservas, passadas: last_reservas });
  } catch (err) {
      res.status(500).send('Erro ao buscar dados da API.');
  } 
});

app.get('/laboratorios/:id_lab/avisos', async (req, res) => {
  const id = req.params.id_lab;
  console.log(id);
  try {
    var url = `http://localhost:3001/api/avisos`;
    console.log(url);
    const apiResponse = await fetch(url);
    const avisos = await apiResponse.json();

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

app.get('/laboratorios/:id_lab/cadastro/reserva', async(req, res) => {
  var id = req.params.id_lab;
  console.log(id);
  res.render('cadastro_reserva');
})

app.get('/cadastro/avisos', async (req, res) => {
  res.render('cadastro_avisos');
});

app.get('/cadastro/laboratorios', async (req, res) => {
  res.render('cadastro_lab');
});

app.get('/cadastro/usuario', async (req, res) => {
  res.render('cadastro_user');
});

app.get('/laboratorios/:id_lab/report/:id_dispositivo', async(req, res) => {
  const id_dispositivo = req.params.id_dispositivo;
  const id_lab = req.params.id_lab;
  res.render('cadastro_report', { id_dispositivo : id_dispositivo, id_lab : id_lab });
});

app.get('/chamados', async (req, res) => {
  res.render('chamados');
});

app.listen(PORT, () => {
  console.log(`Servidor Web SIGLAB rodando na porta ${PORT}`);
});