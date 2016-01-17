'use strict';

var request = require( 'request' );
var xlsx = require( 'node-xlsx' );
var $ = require( 'cheerio' );
var Promise = require( 'bluebird' );
var iconv = require( 'iconv-lite' );
var fs = require( 'fs' );
var querystring = require( "querystring" );
var n = require( "needle" );
var path = require( 'path' );
var url = require( 'url' );

var citys = require( './city.json' );


var timeout = 5000;
function fetch( url, option, cb ) {

    var trycount = 5; //如果试3次都不上就放弃
    var count = 0;

    var defaultOption = Object.assign( {
        encoding: 'GBK',
        compressed: true,
        open_timeout: timeout,
    }, option );

    sendData();

    function sendData() {
        request({ 
            method: 'GET', 
            uri: url, 
            gzip: true,
             encoding: null,
        } ,( err, res, body ) => {

            if ( err ) {
                count++;
                if ( count === trycount ) {
                    console.log( `错误  ${url} 经常尝试${trycount}次连接 依旧失败 ${err}` );
                    addErrPage( url );
                    cb( err, res, body );
                } else {
                    sendData();
                }
            } else {
                try {
                    body = iconv.decode(body, 'gbk');
                    cb( err, res, body );
  
                } catch (e) {
                    console.log(e);
                    console.log(`${url}转码失败`);
                    return;
                }
            }

        } );
    }

}

var baseurl = 'http://m.fang.com/fangjia/'

var cityData = [];

var asycTasksLength = 10;



var errpage = [];
function addErrPage( url ) {
    errpage.push( url );
}


var p = Promise.resolve();

for(var i = 0 ; i < citys.length ; i++ ){
    p = p.then(getData(citys[i]))

         .then(makeXLSX,(url)=>{
            console.log('匹配错误',url);
            addErrPage(url);
         },function(url){
            console.log(url,'匹配失败');
            addErrPage(url);
         })

         .then(function(){

         },(e)=>{
            console.log(e);
         });
}

p.then(function(){

    console.log('完成')

})
.catch(function(e){
    console.log(e);
})

.then(function(){
    return makeJSON({
        filename : 'errorpage',
        datasouce :　errpage
    })
});

function getCityName(body){

    var cityname_reg = /\_vars\.cityname\s=\s"([^"]*)"/ig;

    var result = cityname_reg.exec(body);

    if(result){
        return result[1];
    }else{
        return null;
    }

}

function getData(city){
    var quxian_data = [
        ["区县","价格"]
    ];
    return function(){
        return new Promise( (resolve,reject)=>{
        var url = baseurl + city.sname;
        fetch(url,{
            encoding:'GBK'
        },function(err,res,body){

            try{
                var $doc = $(body);
            }catch(e){
                console.log(e);
                reject(url);
                return ;
            }

            var cityname = getCityName(body);

            if(cityname != city.name){
                console.log(city.name,'名字不匹配')
                reject(url);
                return ;
            }


            var price = $doc.find(".sf-secInfo .price").eq(0).text();

             quxian_data.push([
                city.name,
                price
             ]);

            var $li = $doc.find('.sf-moreCut li');
            var quxian_length = $li.length;

            for(let i = 0 ; i < quxian_length ; i++){

                let $item = $li.eq(i);

                var quxian_name = $item.find('span.name').text();
                var quxian_price = $item.find('.right .bar span em').text();

                quxian_data.push([
                    quxian_name,
                    quxian_price
                ]);
            }

            console.log(city.name,'匹配成功',url);
            resolve({   
                filename : city.name,
                datasouce : quxian_data,
            });

        });
        });
    }
}


function makeXLSX( data ) {

    return new Promise( function ( resolve, reject ) {
        if(!data){
            reject();
            return ;
        }
        var dir = 'city2';
        var filename = data.filename;
        var datasouce = data.datasouce;

        console.log( `正在生成${filename}` );
        var buffer = xlsx.build( [ {
            name: filename,
            data: datasouce
        } ] ); // returns a buffer 
        fs.writeFile( path.join( dir, filename ) + '.xlsx', buffer, 'binary', function ( err ) {
            if ( err ) {
                console.log( `完成 ${filename}保存失败 `, err );
                reject();
            } else {
                console.log( `完成 ${filename}保存成功 ` );
                resolve();
            }

        } );
    } );

}

function makeJSON( data ) {

    var filename = data.filename + '.json';
    var datasouce = data.datasouce;

    return new Promise( ( resolve, reject ) => {

        fs.writeFile( filename , JSON.stringify( datasouce, null, "\t" ), function ( err ) {
            if ( err ) {
                console.log( filename, '保存失败', err );
                reject( err );
            } else {
                console.log( filename, '保存成功' );
                resolve();
            }
        } );
    } );
}

b=[];
for(var i = 0 ;  i < a.length ; i ++){
    var node = a[i];
    b.push({name:node.innerHTML,href:node.href}});
}