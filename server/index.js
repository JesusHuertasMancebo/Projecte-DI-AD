const express = require('express');
const crudUsers = require('./db/crudUsers')
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');


let app = express();
app.use(bodyParser.json());
app.listen(8080, ()=> {
    console.log('Escolte al port 8000');
});

const accessTokenSecret = '?;>+Z@^Jw{O~,2*h)TrV1$?0/t_lsb';
const refreshTokenSecret = '*g">j`{yX,D1UI7)laqbNEWzEr26HO';
const refreshTokens = [];
app.post('/register', (req, res)=>{
    const {dni, username, full_name, avatar, password} = req.body;
    let crudUs = new crudUsers();
    crudUs.getUserByUsername(username, (results, err)=>{
        if(err){ // Tenim en compte si ha habut un error a la BD
            res.status(500).send({
                ok: false,
                error: err
            });
        } else{ // Si no hi ha error, comprovem si l'usuari ja està a la BD o no
            if(results.length){ // Si està, retornem error.
                res.status(400).send({
                    ok: false,
                    error: "L'usuari ja està afegit."
                });
            } else{ // Si l'usuari encara no està a la BD...
                crudUs.checkDNIProfe(dni, (resultDNI, err)=>{ // Agafem els dnis de professors per veure si l'usuari és un professor
                    if(err){ // Si mysql ens dona error, el retornem
                        res.status(500).send({
                            ok: false,
                            error: "Server error: "+err
                        });
                    } else{ // Si tot va bé, farem l'inserció d'usuari
                        crudUs.insertUser({username:username, password:password, full_name:full_name, avatar:avatar}, (err, results, fields)=>{
                            if(err){ // Si mysql ens dona error, el retornem
                                res.status(500).send({
                                    ok: false,
                                    error: "Server error: "+err
                                });
                            } else{ // Si l'inserció en la taula d'usuaris s'ha dut a terme...
                                let userId = results.insertId;
                                if(resultDNI.length){ // Comprovem, per tant, si és profe o no
                                    crudUs.insertProfe(userId); // Si és, insertem l'id del nou usuari a la taula de professors
                                    var role = 'profe'
                                } else{
                                    crudUs.insertAlumne(userId); // Si no és, insertem l'id al de alumnes
                                    var role = 'alumne'
                                }
                                
                                // CONSTRUIM ELS TOKENS
                                const tokenAuth = jwt.sign({
                                    user_id:userId,
                                    username:username,
                                    role:role
                                }, accessTokenSecret, {expiresIn: '2h'});

                                const refreshToken = jwt.sign({
                                    user_id: userId,
                                    username:username,
                                    role:role
                                }, refreshTokenSecret);

                                refreshTokens.push(refreshToken);
                                
                                // Retornem les dades
                                res.status(200).send({
                                    ok:true,
                                    data: {
                                        tokenAuth: tokenAuth,
                                        refreshToken: refreshToken,
                                        avatar: avatar
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
    });
});
app.post('/login', (req, res)=>{
    const {username, password} = req.body;
    let crudUs = new crudUsers(); 
    crudUs.getUserAuth(username, password, (err,user)=>{    
        if(err){ // Tenim en compte si ha habut un error a la BD
            res.status(401).send({
                ok: false,
                error: err
            });
        } else {
            let avatar = ""
            if(user.id){ // Si el id d'usuari ha sigut actualitzat...
                crudUs.getProfeById(user.id, (result, err)=>{ // Agafem els profes per a veure si l'usuari és professor
                    if(err){ // Si mysql ens retorna un error, el retornem nosaltres
                        res.status(500).send({
                            ok: false,
                            error: err
                        });
                    }
                    if(result.length){ // Si el length és major que 0, significa que ha havut un match
                        var role = "profe"; 
                    } else { // Si no, significa que l'usuari és alumne
                        var role = "alumne";
                    }

                    // CREEM ELS TOKENS
                    const tokenAuth = jwt.sign({
                        user_id: user.id,
                        username:username,
                        role:role
                    }, accessTokenSecret, {expiresIn: '2h'});

                    const refreshToken = jwt.sign({
                        user_id: user.id,
                        username:username,
                        role:role
                    }, refreshTokenSecret);

                    refreshTokens.push(refreshToken);

                    res.status(200).send({ // Retronem les dades correctament
                        ok:true,
                        data: {
                            tokenAuth: tokenAuth,
                            refreshToken: refreshToken,
                            avatar: avatar
                        }
                    });
                });
            } else { // Si ve per aci, el login és incorrecte, no hi ha match amb l'usuari i contrasenya
                res.status(401).send({
                    ok: false,
                    error: "Login incorrecte"
                });
            }
        }
    })
});