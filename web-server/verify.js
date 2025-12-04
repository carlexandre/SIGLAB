const jwt = require('jsonwebtoken');

const blacklist = []; 

function verifyLogin(req, res, next) {
    const token = req.cookies.token;

    if (!token) return res.status(401).redirect('/login'); 

    const index = blacklist.findIndex(item => item === token);
 
    if (index !== -1) {
        console.log('Token na blacklist (logout feito anteriormente)');
        return res.status(401).end('Fazer login novamente!'); 
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            console.log('Erro na verificação do token');
            return res.status(403).end('Sessão expirada');
        }
        req.user = decoded;
        res.locals.user = decoded;
        next();
    });
}

module.exports = { verifyLogin, blacklist };