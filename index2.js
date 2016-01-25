'use strict';

var request = require('request');
var xlsx = require('node-xlsx');
var $ = require('cheerio');
var Promise = require('bluebird');
var iconv = require('iconv-lite');
var fs = require('fs');
var querystring = require("querystring");
var n = require("needle");
var path = require('path');
var URL = require('url');
var xlsxSteam = require('xlsx-stream');
var ADODB = require('node-adodb');


// var obj = xlsx.parse('sourcedata/source.xlsx');
// var dataset = obj[0].data;
// var rowscount = dataset.length - 1;
if(process.argv[2]){
    var ID = parseInt(process.argv[2]);
}else{
    var ID = 1;
}
var p = Promise.resolve();


var connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=sourcedata/data.mdb;`);


dosearch(ID);

console.error = (function () {
    var writeStream = fs.createWriteStream('log.txt');
    writeStream.write(new Date().toString());

    process.on('exit', (code) => {
        writeStream.write('\r\n');

      writeStream.end(); //退出时关闭流
      console.log('About to exit with code:', code);
    });

    return function(){
        var args = [];
        for(var i = 0 ; i < arguments.length ; i++){
            args.push(arguments[i]);
        }
        console.log.apply(null,args);
        writeStream.write(args.join(' '));
        writeStream.write('\r\n');
    }

})();

function dosearch(ID) {

    p.then(()=>{
        return new Promise((resolve,reject)=>{
            connection
              .query(`SELECT 城市,小区 FROM shop where ID = ${ID}`)
              .on('done', function (data){
                resolve(data.records[0]);
              })
              .on('fail', function (data){
                reject(data);
                // TODO 逻辑处理 
              });
        });
    })

    .then((data) => {
        var city = data["城市"].replace("市","");
        var projname = data["小区"];

        console.log(`[${ID}] ${city} ${projname}搜索开始`);
        return fetch({
            url: `http://fangjia.fang.com/pinggu/ajax/searchtransfer.aspx?strcity=${escape(city)}&&projname=${escape(projname)}`
                // headers : {
                //     cookie : `pinggucitysort=${escape("深圳")}; pinggucitysortdb=sz`
                // }
        })
    },(data)=>{
        return Promise.reject(data);
    })

    .then((data) => {


        return new Promise((resolve, reject) => {
            var body = iconv.decode(data.body, 'gb2312');

            var $doc = $(body);

            if ($doc.find('.listnone').length > 0) {
                console.log(data.res.request.headers.referer, '没有找到该小区');
            } else if ($doc.find('.moreinfo.clearfix').length > 0 ){
                let url = $doc.find('.moreinfo.clearfix a').attr('href');
                console.log(`[${ID}] 已发现详情页1，正在链接，${url}`);
                resolve(url);
            } else if ($doc.find('.information_li.information_li_more').length > 0) { //直接进入某小区
                let url = data.res.request.uri.href;
                console.log(`[${ID}] 已发现详情页1，正在链接，${url}`);
                resolve(url);
            } else if ($doc.find('.house').length > 0) { //某个list页
                let url = URL.resolve('http://fangjia.fang.com',$doc.find('.house').eq(0).find('.housetitle a').attr('href'));

                console.log(`[${ID}] 没有直接搜索到该小区，从列表中选择第一个小区 , ${url}`);

                fetch({
                        url: url,
                    })
                    .then((data) => {
                        var $doc = $(iconv.decode(data.body,'gb2312'));
                        if ($doc.find('.moreinfo.clearfix').length > 0) {
                            let detail_url = $doc.find('.moreinfo.clearfix a').attr('href');
                            resolve(detail_url);
                        } else if ($doc.find('.information_li.information_li_more').length > 0) { //直接进入某小区
                            let detail_url = data.res.request.uri.href;
                            console.log(`[${ID}] 已发现详情页1，正在链接，${url}`);
                            resolve(detail_url);
                        }else{
                            reject({
                                err : `[${ID}] 详情页1解析失败${url}`
                            });
                        }
                    },(data)=>{
                        reject(data);
                    })
            } else {
                reject({
                    err: `${data.res.request.headers.referer}'未知页面'`
                });
            }


        });

    }, (data)=>{
        return Promise.reject(data);
    })

    .then((url) => {
        var url = URL.resolve( url,'xiangqing');
        console.log(`[${ID}] 详情页 ${url}`);
        return fetch({
            url: url
        })
    },(data)=>{
        return Promise.reject(data);
    })

    .then((data) => {

        return new Promise((resolve,reject)=>{
            var body = iconv.decode(data.body, 'gb2312');
            var $doc = $(body);
            var name = $doc.find( ".maininfo .leftinfo .ewmBoxTitle .floatl" ).text().trim().replace( /\n|\r|\t/g, "" ); //名称
            var price = $doc.find(".pred.pirceinfo").eq(0).text().trim().replace(/\n|\r|\t/g, ""); //价格
            var $baseinfo = $doc.find('.yihang+.lbox').eq(0);
            // var county = $baseinfo.find( "strong:contains(所属区域)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //区县
            // var address = $baseinfo.find( "strong:contains(小区地址)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //'小区地址'
            var wuyeleibie = $baseinfo.find("strong:contains(物业类别)").parent().contents().eq(1).text().trim().replace(/\n|\r|\t/g, ""); //物业类别 
            // var  // wuyegongsi = $xianguanxinxi.find( "strong:contains(代理商：)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //物业类别 
            // var  // wuyedizhi = "", //物业地址
            // var wuyefei = $baseinfo.find( "strong:contains(物 业 费 )" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //物业费
            // var jungongshijian = $baseinfo.find( "strong:contains(竣工时间)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //竣工时间
            // var kaifashang = $baseinfo.find( "strong:contains(开 发 商)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //开发商
            // var jianzhuleibie = $baseinfo.find( "strong:contains(建筑类别)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //建筑类别
            // var jianzhumianji = $baseinfo.find( "strong:contains(建筑面积)" ).parent().contents().eq( 1 ).text().trim().replace( /\n|\r|\t/g, "" ); //建筑面积   
            var zhandimianji = $baseinfo.find("strong:contains(占地面积)").parent().contents().eq(1).text().trim().replace(/\n|\r|\t/g, ""); //占地面积
            var dangqihushu = $baseinfo.find("strong:contains(当期户数)").parent().contents().eq(1).text().trim().replace(/\n|\r|\t/g, ""); //当期户数 
            var zonghushu = $baseinfo.find("strong:contains(总 户 数)").parent().contents().eq(1).text().trim().replace(/\n|\r|\t/g, ""); //总户数
            // var  // tingchewei = $peitao.find( "string:contains(停 车 位：)" ).parent().contents().eq( 1 ).text().trim(); //停车位
            // var jianjie = $jianjie.text().trim(); //小区简介
            // var zhoubian = $zhoubian.text().trim(); //周边信息

            console.log(name,price, wuyeleibie, zhandimianji, dangqihushu, zonghushu);

            let sql = `UPDATE shop set 
            搜房名字='${name}' , 
            价格 = '${price}' , 
            物业类别 = '${wuyeleibie}' , 
            当期户数='${dangqihushu}',
            总户数='${zonghushu}',
            占地面积='${zhandimianji}',
            搜房链接='${data.res.request.uri.href}'
            where ID = ${ID}
            `; 
            connection
              .execute(sql)
              .on('done', function (data){
                resolve(name);
              })
              .on('fail', function (data){
                // TODO 逻辑处理 
                reject(data);
              });
        });
    },(data)=>{
       return Promise.reject(data);
    })
    
    .then((name)=>{
        console.log(`[${ID}] ${name}  success \n`);
    },(data)=>{
        console.error(ID,data.err);
    })

    .then(()=>{
        if (ID <= 6864) {
            ID++;
            dosearch(ID);
        }
    })
}


function fetch(option) {

    return new Promise((resolve, reject) => {
        var trycount = 5; //如果试3次都不上就放弃
        var count = 0;

        var defaultOption = {
            method: 'GET',
            gzip: true,
            encoding: null,
            timeout: 5000,
        }

        Object.assign(defaultOption, option);

        sendData();

        function sendData() {
            try{

                request(defaultOption, (err, res, body) => {
                if (err) {
                    count++;
                    if (count === trycount) {
                        console.error(`错误  ${option.url} 经常尝试${count}次连接 依旧失败 ${err}`);
                        reject({
                            err,
                            res,
                            body,
                        });
                    } else {
                        console.log(`错误  ${option.url} 链接失败 正常尝试${count}次链接`);
                        sendData();
                    }
                } else {
                    resolve({
                        err,
                        res,
                        body,
                    });
                }

                });
            }
            catch(e){
                reject({
                    err:e
                });
            }
        }

    });


}

// var $form = $doc.find('.besic_inform');
//  -          var $table = $form.find('table');
//  +          var $form = $doc.find( '.besic_inform' );
//  +          var $table = $form.find( 'table' );
  
//  -          houseData.price = $table.find('.currentPrice').text().trim();
//  -          houseData.address = $table.find("strong:contains(售楼地址)").parent().contents().eq(1).text().trim();
//  -          houseData.wuyeleibie = $table.find("strong:contains(物业类别)").parent().contents().eq(1).text().trim();
//  -          houseData.wuyefei = $table.find("strong:contains(物 业 费 )").parent().contents().eq(1).text().trim();
//  -          houseData.wuyedizhi = $table.find("strong:contains(物业地址)").parent().contents().eq(1).text().trim();
//  -          houseData.wuyegongsi = $table.find("strong:contains(物业公司)").parent().contents().eq(1).text().trim();
//  -          houseData.jianzhuleibie = $table.find("strong:contains(建筑类别)").parent().contents().eq(1).text().trim();
//  -          houseData.kaifashang = $table.find("strong:contains(开 发 商 )").next().text().trim().replace(/\[房企申请入驻\]/ig, "");
//  +          houseData.price = $table.find( '.currentPrice' ).text().trim();
//  +          houseData.address = $table.find( "strong:contains(售楼地址)" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.wuyeleibie = $table.find( "strong:contains(物业类别)" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.wuyefei = $table.find( "strong:contains(物 业 费 )" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.wuyedizhi = $table.find( "strong:contains(物业地址)" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.wuyegongsi = $table.find( "strong:contains(物业公司)" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.jianzhuleibie = $table.find( "strong:contains(建筑类别)" ).parent().contents().eq( 1 ).text().trim();
//  +          houseData.kaifashang = $table.find( "strong:contains(开 发 商 )" ).next().text().trim().replace( /\[房企申请入驻\]/ig, "" );
  
//  -          houseData.tingchewei = $form.find("#xq_cwxx_anchor").next().text().trim();
//  -          houseData.jianjie = $form.find("#xq_xmjs_anchor").next().text().trim();
//  -          houseData.zhoubian = $form.find("#xq_xmpt_anchor").next().text().trim();
//  +          houseData.tingchewei = $form.find( "#xq_cwxx_anchor" ).next().text().trim();
//  +          houseData.jianjie = $form.find( "#xq_xmjs_anchor" ).next().text().trim();
//  +          houseData.zhoubian = $form.find( "#xq_xmpt_anchor" ).next().text().trim();
  
//  -          var $otherinfo = $form.find("#xq_xgxx_anchor").next().contents();
//  +          var $otherinfo = $form.find( "#xq_xgxx_anchor" ).next().contents();
  
//  -          houseData.zhandimianji = $otherinfo.eq(2).text().trim();
//  +          houseData.zhandimianji = $otherinfo.eq( 2 ).text().trim();
//             // houseData.jianzhumianji = $otherinfo.eq(6).text().trim();
//  -          houseData.jungongshijian = $otherinfo.eq(14).text().trim();
//  +          houseData.jungongshijian = $otherinfo.eq( 14 ).text().trim();
  
//  -          var hushudata = $otherinfo.eq($otherinfo.length - 3).text().trim();
//  +          var hushudata = $otherinfo.eq( $otherinfo.length - 3 ).text().trim();
  
//  -          hushudata.split(' ').forEach((hushu, i) => {
//  -              if (hushu.indexOf("总户数") > -1) {
//  +          hushudata.split( ' ' ).forEach( ( hushu, i ) => {
//  +              if ( hushu.indexOf( "总户数" ) > -1 ) {
//                     houseData.zonghushu = hushu;
//                 }
  
//  -              if (hushu.indexOf("当期户数") > -1) {
//  +              if ( hushu.indexOf( "当期户数" ) > -1 ) {
//                     houseData.dangqihushu = hushu;
//                 }
//  -          });
//  +          } );