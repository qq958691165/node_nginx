const utils={};
utils.log=console.log;

utils.send=function (rs){
    process.send({write:rs});
};
process.on('req',function (req) {
    utils.req=req;
});
process.on('res',function (res) {
    utils.res=res;
});

module.exports= utils;