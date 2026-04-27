const { text } = require("body-parser");
const express= require("express");
const fs=require("fs");
const path= require("path");
const sass= require("sass");
const sharp=require("sharp");
const pg=require("pg");

app= express();
app.set("view engine", "ejs")

obGlobal={
    obErori: null,
    obImagini: null,
    folderScss: path.join(__dirname, "resurse/scss"),
    folderCss: path.join(__dirname, "resurse/css"),
    folderBackup: path.join(__dirname, "backup"),
}


console.log("Folder index.js", __dirname);
console.log("Folder curent (de lucru)", process.cwd());
console.log("Cale fisier", __filename);
app.get("/favicon.ico", function(req, res) {
   
    res.sendFile(path.join(__dirname, "resurse/ico/favicon.ico"));
});

client = new pg.Client({
    database: "cti_2026",
    user: "vlad",
    password: "parola",
    host: "localhost",
    port: 5432,
});
client.connect()
client.query("select * from prajituri where id>3",function(err, rez){
    if (err){
        console.log("Eroare", err);
    }else{
        console.log("Rezultat", rez.rows);
    }
});

let vect_foldere=[ "temp", "logs", "backup", "fisiere_uploadate" ]
for (let folder of vect_foldere){
    let caleFolder=path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(path.join(caleFolder), {recursive:true});   
    }
}
function compileazaScss(caleScss, caleCss) {
    if (!caleCss) {
        let numeFis = path.basename(caleScss, ".scss");
        caleCss = numeFis + ".css";
    }

    if (!path.isAbsolute(caleScss)) caleScss = path.join(obGlobal.folderScss, caleScss);
    if (!path.isAbsolute(caleCss)) caleCss = path.join(obGlobal.folderCss, caleCss);

    let folderBackupCss = path.join(obGlobal.folderBackup, "resurse/css");
    if (!fs.existsSync(folderBackupCss)) {
        fs.mkdirSync(folderBackupCss, { recursive: true });
    }

    if (fs.existsSync(caleCss)) {
        try {
            let numeFisCss = path.basename(caleCss);
            fs.copyFileSync(caleCss, path.join(folderBackupCss, numeFisCss));
        } catch (eroare) {
            console.error(eroare);
        }
    }

    try {
        let rezultat = sass.compile(caleScss);
        fs.writeFileSync(caleCss, rezultat.css);
    } catch (err) {
        console.error(err.message);
    }
}


if (fs.existsSync(obGlobal.folderScss)) {
    
    let fisiereScss = fs.readdirSync(obGlobal.folderScss);
    for (let fis of fisiereScss) {
        if (path.extname(fis) === ".scss") {
            compileazaScss(fis, fis.replace(".scss", ".css")); 
        }
    }

    
    fs.watch(obGlobal.folderScss, function(eveniment, numeFis) {
        if (eveniment === "change" || eveniment === "rename") {
            let caleCompletaScss = path.join(obGlobal.folderScss, numeFis);
            if (fs.existsSync(caleCompletaScss) && path.extname(numeFis) === ".scss") {
                compileazaScss(numeFis, numeFis.replace(".scss", ".css"));
            }
        }
    });
}
function initImagini() {
    var continut = fs.readFileSync(path.join(__dirname, "resurse/json/galerie.json")).toString("utf-8");

    obGlobal.obImagini = JSON.parse(continut);
    let vImagini = obGlobal.obImagini.imagini;
    let caleGalerie = obGlobal.obImagini.cale_galerie;

    let caleAbs = path.join(__dirname, caleGalerie);
    let caleAbsMediu = path.join(caleAbs, "mediu");
    let caleAbsMic = path.join(caleAbs, "mic");
    
    if (!fs.existsSync(caleAbsMediu)) fs.mkdirSync(caleAbsMediu);
    if (!fs.existsSync(caleAbsMic)) fs.mkdirSync(caleAbsMic);

    for (let imag of vImagini) {
        let [numeFis, ext] = imag.fisier_imagine.split("."); 
        let caleFisAbs = path.join(caleAbs, imag.fisier_imagine);
        
        let caleFisMediuAbs = path.join(caleAbsMediu, numeFis + ".webp");
        let caleFisMicAbs = path.join(caleAbsMic, numeFis + ".webp");

        if (!fs.existsSync(caleFisMediuAbs)) {
            sharp(caleFisAbs).resize(300).toFile(caleFisMediuAbs);
        }
        if (!fs.existsSync(caleFisMicAbs)) {
            sharp(caleFisAbs).resize(150).toFile(caleFisMicAbs);
        }

        imag.fisier_mediu = "/" + caleGalerie + "/mediu/" + numeFis + ".webp";
        imag.fisier_mic = "/" + caleGalerie + "/mic/" + numeFis + ".webp";
        imag.fisier = "/" + caleGalerie + "/" + imag.fisier_imagine;
    }
}
initImagini();

app.get(["/","/index","/home"], function(req, res){
    res.render("pagini/index",{
        ip:req.ip,
        imagini:obGlobal.obImagini.imagini
    });
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));
app.use("/dist", express.static(path.join(__dirname, "/node_modules/bootstrap/dist")));

app.get("/favicon.ico", function(req, res){
    res.sendFile(path.join(__dirname,"resurse/ico/favicon.ico"))
});


function initErori(){
    let continut = fs.readFileSync(path.join(__dirname,"resurse/json/erori.json")).toString("utf-8");
    let erori=obGlobal.obErori=JSON.parse(continut)
    let err_default=erori.eroare_default
    err_default.imagine=path.join(erori.cale_baza, err_default.imagine)
    for (let eroare of erori.info_erori){
        eroare.imagine=path.join(erori.cale_baza, eroare.imagine)
    }
}
initErori()



function afisareEroare(res, identificator,titlu, text,imagine){

    let eroare=obGlobal.obErori.info_erori.find(function(elem){
        return elem.identificator==identificator;
    })
    let errDefault=obGlobal.obErori.eroare_default;
    if(eroare?.status)
       res.status(eroare.identificator)
     res.render("pagini/eroare", {
        imagine: imagine || eroare?.imagine||errDefault.imagine,
        titlu: titlu|| eroare?.titlu || errDefault.titlu,
        text: text || eroare?.text || errDefault.text,
    
     });

}



 
app.get("/*pagina", function(req, res){
    console.log("Cale pagina", req.url);
    if (req.url.startsWith("/resurse") && path.extname(req.url)==""){
        afisareEroare(res,403);
        return;
    }
    if (path.extname(req.url)==".ejs"){
        afisareEroare(res,400);
        return;
    }
    try{
        res.render("pagini"+req.url, function(err, rezRandare){
            if (err){
                if (err.message.includes("Failed to lookup view")){
                    afisareEroare(res,404)
                }
                else{
                    afisareEroare(res);
                }
            }
            else{
                res.send(rezRandare);
                console.log("Rezultat randare", rezRandare);
            }
        });
    }
    catch(err){
        if (err.message.includes("Cannot find module")){
            afisareEroare(res,404)
        }
        else{
            afisareEroare(res);
        }
    }
});
 
app.listen(8080);
console.log("Serverul a pornit!");