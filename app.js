// Módulos
var express = require('express');
var app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, UPDATE, PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, token");
    // Debemos especificar todas las headers que se aceptan. Content-Type , token
    next();
});


var jwt = require('jsonwebtoken');
app.set('jwt',jwt);

var fs = require('fs');
var https = require('https');

const { check, validationResult } = require('express-validator/check');

//session
var expressSession = require('express-session');
app.use(expressSession({
    secret: 'abcdefg',
    resave: true,
    saveUninitialized: true
}));

//crypto
var crypto = require('crypto');

//subida de ficheros
var fileUpload = require('express-fileupload');
app.use(fileUpload());

//mongodb
var mongo = require('mongodb');
var swig = require('swig');

//esto antes de las peticiones.
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//Inicializamos el gestor de BD que usará MongoDB
var gestorBD = require("./modules/gestorBD.js");
gestorBD.init(app, mongo);


// routerUsuarioToken
var routerUsuarioToken = express.Router();
routerUsuarioToken.use(function(req,res,next) {
    // obtener el token, vía headers (opcionalmente GET y/o POST).

    var token = req.headers['token'] || req.body.token ||req.query.token;
    if (token != null){
        // verificar el token
        jwt.verify(token, 'secreto', function(err, infoToken) {
            if (err || (Date.now()/1000 - infoToken.tiempo) > 240 ){
                res.status(403); // Forbidden
                res.json({
                    acceso : false,
                    error: 'Token invalido o caducado'
                });
                //TODO
                // También podríamos comprobar que intoToken.usuario existe. En el else también.
                return;

            } else {
                // dejamos correr la petición
                res.usuario = infoToken.usuario;
                next();
            }
        });

    } else {
        res.status(403); // Forbidden
        res.json({
            acceso : false,
            mensaje: 'No hay Token'
        });
    }
});
// Aplicar routerUsuarioToken
app.use('/api/cancion', routerUsuarioToken);


// routerUsuarioSession
var routerUsuarioSession = express.Router();
routerUsuarioSession.use(function (req, res, next) {
    console.log("routerUsuarioSession");
    if (req.session.usuario) {
        // dejamos correr la petición
        next();
    } else {
        console.log("va a : " + req.session.destino)
        res.redirect("/identificarse");
    }
});

//Aplicar routerUsuarioSession
app.use("/canciones/agregar", routerUsuarioSession);
app.use("/publicaciones", routerUsuarioSession);
app.use("/cancion/comprar", routerUsuarioSession);
app.use("/compras", routerUsuarioSession);


//routerUsuarioAutor
var routerUsuarioAutor = express.Router();
routerUsuarioAutor.use(function (req, res, next) {
    console.log("routerUsuarioAutor");
    var path = require('path');
    var id = path.basename(req.originalUrl);
// Cuidado porque req.params no funciona
// en el router si los params van en la URL.
    gestorBD.obtenerCanciones(
        {_id: mongo.ObjectID(id)}, function (canciones) {
            console.log(canciones[0]);
            if (canciones[0].autor == req.session.usuario) {
                next();
            } else {
                res.redirect("/tienda");
            }
        })
});
//Aplicar routerUsuarioAutor
app.use("/cancion/modificar", routerUsuarioAutor);
app.use("/cancion/eliminar", routerUsuarioAutor);


//https://bit.ly/2WAKY5p



//routerAudios
var routerAudios = express.Router();
routerAudios.use(function (req, res, next) {
    console.log("routerAudios");
    var path = require('path');
    var idCancion = path.basename(req.originalUrl, '.mp3');
    gestorBD.obtenerCanciones(
        {_id: mongo.ObjectID(idCancion)}, function (canciones) {
            if (req.session.usuario && canciones[0].autor == req.session.usuario) {
                next();
            } else {
                var criterio = {
                    usuario: req.session.usuario,
                    cancionId: mongo.ObjectID(idCancion)
                };

                gestorBD.obtenerCompras(criterio, function (compras) {
                    if (compras != null && compras.length > 0) {
                        next();
                    } else {
                        res.redirect("/tienda");
                    }
                });
            }
        })
});
//Aplicar routerAudios
app.use("/audios/", routerAudios);


// Variables
app.set('port', 8081);
app.set('db', 'mongodb://admin:Caquita05.@tiendamusica-shard-00-00-ntnag.mongodb.net:27017,tiendamusica-shard-00-01-ntnag.mongodb.net:27017,tiendamusica-shard-00-02-ntnag.mongodb.net:27017/test?ssl=true&replicaSet=tiendamusica-shard-0&authSource=admin&retryWrites=true');
app.set('clave', 'abcdefg');
app.set('crypto', crypto);

app.use(express.static('public'));

//Rutas/controladores por lógica
require("./routes/rusuarios.js")(app, swig, gestorBD); // (app, param1, param2, etc.)
require("./routes/rcanciones.js")(app, swig, gestorBD); // (app, param1, param2, etc.)
require("./routes/comentarios.js")(app, swig, gestorBD);
require("./routes/rapicanciones.js")(app, gestorBD);


//página inicio estándar
app.get('/', function (req, res) {
    res.redirect('/tienda');
})

//manejo de errores
app.use(function (err, req, res, next) {
    console.log("Error producido: " + err); //we log the error in our db
    if (!res.headersSent) {
        res.status(400);
        res.send("Recurso no disponible");
    }
});

// nuevo lanzar el servidor con http
https.createServer({
    key: fs.readFileSync('certificates/alice.key'),
    cert: fs.readFileSync('certificates/alice.crt')
}, app).listen(app.get('port'), function() {
    console.log("Servidor activo");
});




/* para la parte de añadir validador (express-validator):
app.post(...)
    ...
    req.check('fieldName', 'error message sent').isLength({
        min:4
    })
    var errors = req.validationErrors();
    if (errors){
        req.session.errors = errors
    }
    ....
    configurar mensajes de error en los html

    Los métodos tipo isLength son de una lib validator.js creo

*/


