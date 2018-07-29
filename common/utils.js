const utils={};
utils.log=console.log;

let output;

utils.send=function (rs){
    process.send({write:rs});
};
utils.session= new Proxy({},{
    set:function(target,key,value,receiver){
        console.log(target,key,value,receiver);
        process.send({
            setSession:{
                key:key,
                value:value
            }
        });
    }
});
process.on('message',function (obj) {
    if (obj.session!==undefined){
        utils.session=obj.session;
    }
});

module.exports= utils;