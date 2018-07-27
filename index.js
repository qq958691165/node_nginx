const u=require('./common/utils');

const express = require('express');
const fs = require('fs');
const { fork } = require('child_process');

let config=fs.readFileSync('./config.json');
config=JSON.parse(config);

const app=express();

const projects=config.projects;

let isDynamic=false;

function retFile(path,req,res){
    let rs;
    if(fs.existsSync(path)){
        const stat=fs.statSync(path);
        if(stat.isDirectory()){
            config.index.split(',').reverse().forEach(item => {
                if(rs=retFile(path+item,req,res)){
                    return rs;
                }
            });
        }else{
            const ext=path.match(/\.([\w]*)$/);
            switch(ext[1]){
                case 'xjs':
                    isDynamic=true;
                    rs='';
                    const child=fork(path,{
                        silent: false
                    });

                    child.send('req',req);
                    child.send('res',res);

                    child.on('message', (msg) => {
                        u.log(msg);
                        if (msg.write){
                            res.send(msg.write);
                        }
                    });
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
            
            rs=retFile(path,req,res);
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