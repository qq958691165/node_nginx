const u=require('./common/utils');

const express = require('express');
const fs = require('fs');
const { fork,exec } = require('child_process');
const session = require('express-session');
const cookieParser = require('cookie-parser');

let config=fs.readFileSync('./config.json');
config=JSON.parse(config);

const app=express();
app.use(cookieParser());
app.use(session({
    secret: '12345',
    name: 'testapp',   //这里的name值得是cookie的name，默认cookie的name是：connect.sid
    cookie: {maxAge: 80000 },  //设置maxAge是80000ms，即80s后session和相应的cookie失效过期
    resave: false,
    saveUninitialized: true,
}));

const projects=config.projects;

let isDynamic=false;

function retFile(path,req,res,project){
    let rs;
    if(fs.existsSync(path)){
        const stat=fs.statSync(path);
        if(stat.isDirectory()){
            config.index.split(',').reverse().forEach(item => {
                if(rs=retFile(path+item,req,res,project)){
                    return rs;
                }
            });
        }else{
            const ext=path.match(/\.([\w]*)$/);
            let child;
            switch(ext[1]){
                case 'php':
                    isDynamic=true;
                    rs='';
                    child=exec('php-cgi '+path,(error, stdout, stderr)=>{
                        if (error){
                            res.send(error+"");
                        } else{
                            rs=stdout;
                            const preg=/((.|\r|\n)*)?\r\n\r\n/;
                            let headers=stdout.match(preg)[1];
                            const hpreg=new RegExp(headers,"g");
                            stdout=stdout.replace(hpreg,"");
                            headers=headers.split('\r\n');
                            let setHeader={};
                            headers.forEach((item)=>{
                                if (item) {
                                    const sitem = item.split(': ');
                                    setHeader[sitem[0]] = sitem[1];
                                }
                            });
                            res.set(setHeader);
                            res.send(stdout);
                        }
                    });
                    break;
                case 'pjs':
                    isDynamic=true;
                    rs='';
                    child=fork(path,{
                        silent:true,
                    });
                    child.on('close',(code,signal)=>{
                        u.log('asdf');
                    });
                    child.stderr.on('data',(data)=>{
                        if (project.debug) {
                            res.send('<pre>' + data + "</pre>");
                        }else{
                            res.status(500);
                            res.send('500 server error');
                        }
                    });

                    req.session.name='asdfs';

                    child.send({'session':JSON.stringify(req.session)});

                    child.on('message', (msg) => {
                        if (msg.write!==undefined){
                            try {
                                res.send(msg.write);
                            }catch (e) {
                                res.send(e);
                            }
                        }
                        if (msg.setSession!==undefined){
                            req.session[msg.setSession.key]=msg.setSession.value;
                        }
                    });
                    break;
                case "html":
                    rs=fs.readFileSync(path)+"";
                    break;
                default:
                    u.log(ext[1]);
                    res.attachment(path);
                    rs=fs.readFileSync(path);
                    break;
            }
        }
    }
    return rs;
}

app.all('*',function(req,res){
    config=fs.readFileSync('./config.json');
    config=JSON.parse(config);
    
    let host=req.headers.host;
    host=host.replace(':'+config.port,'');
    let rs;
    projects.forEach(project => {
        if(project.server==host){
            let path='./projects/'+project.path+'/'+req.url;
            
            rs=retFile(path,req,res,project);
        }
    });
    if(rs===undefined){
        res.status(404);
        res.send('<h3>404 not found</h3>');
    }else{
        res.status(200);
        if (!isDynamic){
            res.send(rs);
        }
    }
});

const server=app.listen(config.port,function(){
    u.log('Example app listening at http://%s:%s', server.address().address, server.address().port);
});