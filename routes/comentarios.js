module.exports = function (app, swig, gestorBD) {
    app.get("/comentarios/agregar", function (req, res) {
        var respuesta = swig.renderFile('views/bcomentarios.html', {});
        res.send(respuesta);
    });

    app.post("/comentar", function (req, res) {
        var comentario = {
            texto: req.body.texto,
            autor: req.session.usuario,
            fecha: new Date()
        }
        gestorBD.insertarComentario(comentario, function (id) {
            if (id == null) {
                res.send("Error al insertar ");
            } else {
                res.send("Agregado el comentario con ID: " + id);
            }
        });
    });

    app.get("/comentarios/listar", function(req,res){
        gestorBD.obtenerComentarios(function (comentarios) {
            if (comentarios == null) {
                res.send("Error al listar comentarios");
            } else {
                var respuesta = swig.renderFile('views/blistarComentarios.html',
                    {
                        comentarios: comentarios
                    });
                res.send(respuesta);
            }
        });
    });
}