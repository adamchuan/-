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


var citys = require( './city2.json' );
var province = require( './province.json' );

var startPage = 1;
var maxPage = 20;
var citylength = 100;
var maxTasksLength = 20; /* 确保同时发起的http链接不超过10个 */
var timeout = 10000; //如果5s还没打开页面 
var maskPageTaskLength = 10; //同时抓取页面的长度
var fenye = 1000;
var totalcount = 0;
var taskTimeout = 1000 * 20; //如果一个任务15秒还没完成 就继续退出这个任务

var city_length = citys.length;

var p = Promise.resolve();

for ( let i = 6 ; i < city_length; i++ ) {
    p = p.then(  getCityData( citys[ i ] ) );
};

p.then( function () {
    console.log( totalcount );
} );


var nowProvince = "";
var nowPage = "";

var errpage = [];

function addErrPage( url ) {

    errpage.push( url );

}


function getCityData( city ) {

    return function () {

        return new Promise( function ( resolve, reject ) {

            console.log( `开始 拉取${city.name}的数据` );

            var citysdata = []; //储存每个城市的数据

            var page = 1;

            var p = Promise.resolve();

            function failHandler( err ) {
                console.log( err );
            }

            p.then( function () {
                var url = `${city.href}/loupan/list-page1.html`
                return getTotalPage( url );
            } )

            .then( function ( totalPage ) {

                console.log( `${city.name} 新房 共有 ${totalPage} 页` );
                var p = Promise.resolve();

                for ( let page = startPage; page <= totalPage ; page++ ) {

                    var url = `${city.href}/loupan/list-page${page}.html`;
                    p = p.then( getList( url,city,page, citysdata ), failHandler )

                    .then( (finishPage)=> {

                        if(citysdata.length >= fenye){  //超过分页立即保存

                            totalcount += citysdata.length;

                            return makeXLSX({
                                dir : 'city4',
                                filename : `${city.name}-'xf'-${finishPage}`,
                                datasouce : citysdata,
                            })
                        
                            .then( ()=>{
                                if(errpage.length > 0){
                                  return makeJSON({
                                      dir : 'city4error',
                                      filename : `${city.name}-xf-${finishPage}-error`,
                                      datasouce : errpage,
                                  })  
                                }
                            })

                            .then(()=>{
                                citysdata = [];
                                errpage = [];
                                console.log(`${city.name}超过${fenye}条 已保存`);
                            })
                        }

                    });
                }

                p.then( ()=> {
                    console.log( `完成 拉取${city.name}的新房数据` );
                },(err) =>{
                    console.log(err);
                    console.log( `完成 拉取${city.name}的新房数据` );
                } )

                return p;
            } )

            .then(function(){
                var url = `${city.href}/loupan/esf/list-page1.html`
                return getTotalPage( url ); 
            })

            .then(function(totalPage){

                console.log( `${city.name} 二手房 共有 ${totalPage} 页` );

                var p = Promise.resolve();

                for ( let page = startPage; page <= totalPage; page++ ) {

                    var url = `${city.href}/loupan/esf/list-page${page}.html`;
                    p = p.then( getList( url,city,page, citysdata ), failHandler )

                    .then( (finishPage)=> {

                        if(citysdata.length >= fenye){  //超过分页立即保存

                            totalcount += citysdata.length;

                            return makeXLSX({
                                dir : 'city4',
                                filename : `${city.name}-esf-${finishPage}`,
                                datasouce : citysdata,
                            })
                       
                            .then( ()=>{
                                if(errpage.length > 0){
                                  return makeJSON({
                                      dir : 'city4error',
                                      filename : `${city.name}-esf-${finishPage}-error`,
                                      datasouce : errpage,
                                  })  
                                }
                            })

                            .then(()=>{
                                citysdata = [];
                                errpage = [];
                                console.log(`${city.name}超过${fenye}条 已保存`);
                            })
                        }

                    });
    
                }

                p.then( () =>{
                    console.log( `完成 拉取${city.name}的二手房数据` );
                },() =>{
                    console.log(err);
                    console.log( `完成 拉取${city.name}的二手房数据` );
                } )

                return p;

            })

            .then( () =>{
                console.log( `完成 拉取${city.name}的新房数据` );
            },(err) =>{
                console.log(err)
                console.log( `完成 拉取${city.name}的新房数据` );
            })

            .catch( function ( e ) {
                console.log( "程序错误", e );
                console.log( `完成 拉取${city.name}的数据` );
            } )

            .then( () =>{
                totalcount += citysdata.length;
                return makeXLSX({
                    dir : 'city4',
                    filename : city.name,
                    datasouce : citysdata,
                })
            })

            .then( ()=>{
                if(errpage.length > 0){
                  return makeJSON({
                      dir : 'city4error',
                      filename : city.name + '-error',
                      datasouce : errpage,
                  })  
              }
            })

            .then(()=>{
                errpage = [];
                resolve();
            })



        } );

    }
}

function getESFList(){

    return new Promise((resolve,reject)=>{


    });
}


function getXfList(){

    return new Promise((resolve,reject)=>{


    });

}

function getList(list_url,city,page,citysdata){ //二手房

    return function () {

        return new Promise( function ( resolve, reject ) {

            fetch( list_url, ( err, red, body ) => {
                if ( err ) {
                    console.log( err );
                    resolve();
                } else {

                    var $doc = $( body );
                    var $list = $doc.find( '.loupan-list1-s0' );

                    /* 分批传送 */

                    if ( $list.length == 0 ) {

                        resolve();

                    } else{

                        let tasks = [];

                        for(let i = 0 ; i < $list.length ; i++){

                             var $item = $list.eq(i);    

                             let detail_url = $item.attr('href').replace(/loupan/ig,'detail');

                             tasks.push(getDetail( detail_url,city, citysdata ));

                        }

                        Promise.all( tasks )

                        .then( () => {
                             console.log( `\r\n抓取 ${city.name} ${page} 成功\r\n` );
                             resolve(page);
                        }, ( url ) => {
                            console.log( `\r\n抓取  ${city.name} ${page} 失败\r\n` );
                             resolve(page);
                        } )

                    }
                }
            } );

        } );

    }
}

function getDetail(detail_url,city,citysdata){

    var detailPromise = new Promise( function ( resolve, reject ) {
        // let detailPage = `http://m.fang.com/xf/${city}/${pageid}.htm`;

        fetch( detail_url , ( err, res, body ) => {

            if ( err ) {
                console.log( `错误 详情页 ${detail_url} url分析失败 ${err}` );
                resolve();
                return;
            }

            body = $( body );
            var $doc = $( body );


            var name = "", //名称
                price = "", //价格
                cityname = city.name, //城市
                county = "", //区县
                tese = "" , //特色
                address = "", //'小区地址'
                wuyeleibie = "", //物业类别 
                wuyegongsi = "", //物业公司
                wuyedizhi = "", //物业地址
                wuyefei = "", //物业费
                jungongshijian = "", //竣工时间
                kaifashang = "", //开发商
                jianzhuleibie = "", //建筑类别
                jianzhumianji = "", //建筑面积  
                zhandimianji = "", //占地面积
                dangqihushu = "", //当期户数 
                zonghushu = "", //总户数
                tingchewei = "", //停车位
                jianjie = "", //小区简介
                zhoubian = "", //周边信息
                lat, //精度
                lng //维度

            console.log( `开始 详情页 ${detail_url} 分析` );

            //名字
            name = $doc.find('h1.public-lpm2').text().trim();

            //得到区县
            var $quxian = $doc.find('.public-m5 a').slice(2);
            for(let i = 0 ; i < $quxian.length ; i++){
                county += $quxian.eq(i).text().trim();
            }

            //特色
            var $tese = $doc.find('.public-lpm4 span');
            for(var i = 0; i < $tese.length ; i++){
                tese += $tese.eq(i).text().trim() + " ";
            }

            var $table = $doc.find('.lpm-section4-table.mt30')

            //价格
            price = $table.find('td:contains(单价)').next().text().trim().replace( /\n|\r|\t/g, "" );

            //得到地址
            address = $table.find('td:contains(楼盘地址)').next().text().replace( /\n|\r|\t/g, "" );

            //物业相关
            wuyedizhi = $table.find('td:contains(售楼处地址)').next().text().trim().replace( /\n|\r|\t/g, "" );
            wuyefei = $table.find('td:contains(物  业 费)').next().text().trim().replace( /\n|\r|\t/g, "" );
            wuyegongsi = $table.find('td:contains(物业公司)').next().text().trim().replace( /\n|\r|\t/g, "" );
            wuyeleibie = $table.find('td:contains(物业类型)').next().text().trim().replace( /\n|\r|\t/g, "" );
            zhandimianji = $table.find('td:contains(规划面积)').next().text().trim().replace( /\n|\r|\t/g, "" );
            jungongshijian = $table.find('td:contains(工程进度)').next().text().trim().replace( /\n|\r|\t/g, "" );
            jianzhumianji = $table.find('td:contains(建筑面积)').next().text().trim().replace( /\n|\r|\t/g, "" );
            jianzhuleibie = $table.find('td:contains(建筑形式)').next().text().trim().replace( /\n|\r|\t/g, "" );
            tingchewei = $table.find('td:contains(开  发 商)').next().text().trim().replace( /\n|\r|\t/g, "" );
            kaifashang = $table.find('td:contains(车  位 数)').next().text().trim().replace( /\n|\r|\t/g, "" );

            //户数
            var hushudata = $table.find('td:contains(规划户数)').next().text().trim().replace( /\n|\r|\t/g, "" )
            if( hushudata.indexOf( "总户数" ) > -1 ){
                zonghushu = hushudata.split("总户数")[1].split("当期户数")[0];
            }
            if( hushudata.indexOf( "当期户数" ) > -1){
                dangqihushu =  hushudata.split("当期户数")[1].split("总户数")[0];
            }
            // hushudata.split( ' ' ).forEach( ( hushu, i ) => {
            //     if ( hushu.indexOf( "总户数" ) > -1 ) {
            //         zonghushu = hushu;
            //     }

            //     if ( hushu.indexOf( "当期户数" ) > -1 ) {
            //         dangqihushu = hushu;
            //     }
            // } );

            //简介
            jianjie = $doc.find('strong:contains(项目介绍)').parent().next().text().trim();

            //周边
            zhoubian = $doc.find('strong:contains(区位介绍)').parent().next().text();

            getMap(detail_url.replace(/detail/ig,'loupan'))

            .then(function(mapData){

                var houseData = [
                    name , //名称
                    price , //价格
                    cityname , //城市
                    county , //区县
                    tese  , //特色
                    address , //'小区地址'
                    wuyeleibie , //物业类别 
                    wuyegongsi , //物业公司
                    wuyedizhi , //物业地址
                    wuyefei , //物业费
                    jungongshijian , //竣工时间
                    kaifashang , //开发商
                    jianzhuleibie , //建筑类别
                    jianzhumianji , //建筑面积  
                    zhandimianji , //占地面积
                    dangqihushu , //当期户数 
                    zonghushu , //总户数
                    tingchewei , //停车位
                    jianjie , //小区简介
                    zhoubian , //周边信息
                    mapData.lat, //精度
                    mapData.lng //维度
                ]

                citysdata.push(houseData);
                console.log("完成",name,"详情页抓取");
                resolve();
            });

        } );
    } );

    return detailPromise;
    // return Promise.race( [ timeoutPromise( taskTimeout,()=>{ 
    //     console.log(`详情页 ${detail_url} 超时`)
    //     addErrPage(detail_url);
    // } ), detailPromise ] );

}

function getMap( map_url ) { //得到经纬度
    return new Promise( ( resolve, reject ) => {
        fetch( map_url, ( err, res, body ) => {

            var lng = "" , lat = "";

            if ( err ) {
                console.log( '错误 map页', map_url, '分析失败', err );
            }else{
               var lng_reg = /lng(\s)*=(\s)*['"]([^"']*)['"]/ig; //纬度
               var lat_reg = /lat(\s)*=(\s)*['"]([^"']*)['"]/ig; //精度

               var x_result = lng_reg.exec( body ),
                   y_result = lat_reg.exec( body );

               if ( x_result != null ) {
                   lng = x_result[ 3 ];
               }
               if ( y_result != null ) {
                   lat = y_result[ 3 ];
               } 
            }

            resolve({
                lng,
                lat
            });

        } );
    } );
}


function getTotalPage( url ) {
    return new Promise( ( resolve, reject ) => {
        fetch( url, ( err, red, body ) => {

            if ( err ) {
                console.log( err );
                totalPage = 1;
  
            }else{
                var $doc = $( body );

                var totalPage = parseInt( $doc.find(".tg-rownum-num li").last().text() );

                if ( totalPage.toString() === 'NaN' ) {
                    totalPage = 1;
                }
            }

            resolve( totalPage );

        } );
    } )
}


function timeoutPromise( time ,fn) {
    return new Promise( ( resolve, reject ) => {
        setTimeout( function () {
            if(fn){
                fn();
            }
            resolve();
        }, time );
    } );
}


function makeJSON( data ) {

    var dir = data.dir;
    var filename = data.filename;
    var datasouce = data.datasouce;
    var filepath = path.join( dir, filename );

    return new Promise( ( resolve, reject ) => {

        fs.writeFile( filepath + '.json', JSON.stringify( datasouce, null, "\t" ), function ( err ) {

            datasouce = null;
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


function makeXLSX( data ) {

    var dir = data.dir;
    var filename = data.filename;
    var datasouce = data.datasouce;
    var filepath = path.join( dir, filename );

    var savedata = [
        [ 
            '小区名称',
            '价格',
            '城市',
            '区县',
            '小区特色',
            '小区地址',
            '物业类别',
            '物业公司',
            '物业地址',
            '物业费',
            '竣工时间',
            '开发商',
            '建筑类别',
            '建筑面积',
            '占地面积',
            '当期户数',
            '总户数',
            '停车位',
            '小区简介',
            '周边信息',
            '经度',
            '纬度',
        ]
    ].concat( datasouce );

    return new Promise( function ( resolve, reject ) {
        console.log( `正在生成${filename}` );
        var buffer = xlsx.build( [ {
            name: filename,
            data: savedata,
        } ] ); // returns a buffer 
        fs.writeFile( filepath + '.xlsx', buffer, 'binary', function ( err ) {

            savedata = null;
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

function fetch( url,cb ) {

    var trycount = 3; //如果试3次都不上就放弃
    var count = 0;

    sendData();

    function sendData() {
        request({ 
            method: 'GET', 
            uri: url, 
            gzip: true,
            timeout:taskTimeout,
        } , ( err, res, body ) => {

            if ( err ) {
                count++;
                if ( count === trycount ) {
                    console.log( `错误  ${url} 经常尝试3次连接 依旧失败 ${err}` );
                    addErrPage( url );
                    cb( err, res, body );
                } else {
                    sendData();
                }
            } else {
                cb( err, res, body );
            }

        } );
    }

}