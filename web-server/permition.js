// Middleware para verificar permissão
const checkTipo = (tiposPermitidos) => {
    return (req, res, next) => {
        // Verifica se o usuário está logado e se tem o papel necessário
        if (req.user && tiposPermitidos.includes(req.user.tipo)) {
            next();
        } else {
            res.redirect('/laboratorios'); // Redireciona se não tiver permissão
        }
    }
};

module.exports = { checkTipo };