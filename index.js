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
var url = require('url');
var xlsxSteam = require('xlsx-stream');

var citys = require('./sourcedata//citys.json');
var province = require('./sourcedata//province.json');

var startPage = 1;
var citylength = 100;
var maxTasksLength = 20; /* 确保同时发起的http链接不超过10个 */
var timeout = 10000; //如果5s还没打开页面 
var maskPageTaskLength = 10; //同时抓取页面的长度
var MAX_CACHE_LENGTH = 1000; // 最大缓存数
var totalcount = 0;
var taskTimeout = 1000 * 20; //如果一个任务15秒还没完成 就继续退出这个任务

var city_length = citys.length;

var p = Promise.resolve();

for (let i = 0; i < city_length ; i++) {
    p = p.then(createXLSX(citys[i].name))
        .then(getCityData(citys[i]));
};

var logfunc = console.log;
console.log = function(){
    var date = new Date();
    var time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    var args = [time];
    for(var i = 0 ; i < arguments.length ; i++){
        args.push(arguments[i]);
    }
    logfunc.apply(null,args);
};


p.then(function () {
    console.log(totalcount);
});


var nowProvince = "";
var nowPage = "";

var errpage = [];

var xlsx_dir = 'xlsx';
var error_dir = 'error_url';

makedir(xlsx_dir);
makedir(error_dir);

function createXLSX(name){
    return function(){
        return new Promise((resolve,reject)=>{
            var buffer = xlsx.build([{
                name: name,
                data: [],
            }]); // returns a buffer 

            fs.writeFile( path.join(xlsx_dir,name+'.xlsx'), buffer, 'binary', function (err) {
                resolve();
            });
        })
    }
}

function makedir(dir){
    if( !fs.existsSync(dir) ){
        fs.mkdirSync(dir);
    }
}

function addErrPage(url) {

    errpage.push(url);

}


function getCityData(city) {

    return function () {

        return new Promise(function (resolve, reject) {

            console.log(`[${city.name}] 数据拉取开始`);

            var taskPool = []; //任务池
            var finishCount = 0;
            var maxTasksLength = 100; /* 确保同时发起的http链接不超过100个 */
            var runingTaskCount = 0;
            var endflag = false; // 所有list数据是不是都添加了

            var filepath = path.join(xlsx_dir,`${city.name}.xlsx`);

            Promise.resolve()

            .then(getXfList(taskPool, city, runTask))

            .then(getESFList(taskPool, city, runTask))

            .then(() => {
                endflag = true;
            });

            function failHandler(err) {
                console.log(err);
            }


            var x = xlsxSteam();
            var writeable = fs.createWriteStream(filepath);
            x.pipe(writeable);

            var sheet = x.sheet(city.name);


            sheet.write([
                '小区名称',
                '城市',
                '区县',
                "单价", 
                "开盘时间", 
                "交房时间", 
                "售楼处电话", 
                "楼盘地址", 
                "装修状况", 
                "建筑形式", 
                "规划面积", 
                "建筑面积", 
                "主力户型", 
                "容  积 率", 
                "绿  化 率", 
                "房屋产权", 
                "规划户数", 
                "车  位 数", 
                "物业公司", 
                "物业类型", 
                "物  业 费", 
                "开  发 商", 
                "销售代理", 
                "工程进度", 
                "预售许可证", 
                "售楼处地址", 
                "房屋朝向", 
                "建筑设计单位", 
                "栋数", 
                "施工单位",
                "经度",
                "纬度",
                "小区简介",
                "小区周边",
                "详情页地址",
            ]);


            function runTask() {

                if (runingTaskCount >= maxTasksLength || taskPool.length == 0) { //超过执行任务数上限 或者已经完成任务 直接退出
                    return;
                }

                var detail_url = taskPool.shift();
                runingTaskCount++;

                getDetail(detail_url, city)

                .then((houseData) => {

                    runingTaskCount--;

                    totalcount ++ ;

                    try{
                        sheet.write(houseData);
                    }              
                    catch(e){
                        console.log(e);
                        console.log(houseData);
                        addErrPage(houseData);
                    } 

                    var isFinish = (endflag && taskPool.length == 0 && runingTaskCount == 0);
                    if ( isFinish ) {
                        console.log(`[${city.name}] 数据拉取完成`);
                        sheet.end();
                        x.finalize();
                        if(errpage.length > 0 ){
                            makeJSON({
                                filename:city.name,
                                datasouce:errpage,
                                dir:error_dir
                            })
                            .then(()=>{
                                errpage = [];
                                resolve();
                            });
                        }else{
                            resolve();
                        }

                    } else {
                        runTask();
                    }                

                });

            }

        });

    }
}

function getESFList(taskPool, city, runTask) {

    return function () {

        return new Promise((resolve,reject)=>{

            var url = `${city.href}/loupan/esf/list-page1.html`;

            var p = getTotalPage(url)

            .then(function (totalPage) {

                console.log(`[${city.name}] 二手房列表 共有 ${totalPage} 页`);

                var p = Promise.resolve();

                for (let page = startPage; page <= totalPage; page++) {

                    var url = `${city.href}/loupan/esf/list-page${page}.html`;
                    p = p.then(getList(url))

                    .then((details) => {
                        Array.prototype.push.apply(taskPool, details);
                        console.log(`[${city.name}] 任务池添加成功 当前任务数${taskPool.length}`);
                        runTask();
                    });

                }

                p.then(()=>{
                    console.log(`[${city.name}] 二手房列表 拉取完成`);
                    resolve();
                });

            });

        });

    }
}


function getXfList(taskPool, city, runTask) {
    return function () {
        return new Promise( (resolve,reject)=>{
            var url = `${city.href}/loupan/list-page1.html`;
            var p = getTotalPage(url)

            .then(function (totalPage) {

                console.log(`[${city.name}] 新房列表 共有 ${totalPage} 页`);
                var p = Promise.resolve();

                for (let page = startPage; page <= totalPage; page++) {

                    var url = `${city.href}/loupan/list-page${page}.html`;
                    p = p.then(getList(url))

                    .then((details) => {
                        Array.prototype.push.apply(taskPool, details);
                        console.log(`[${city.name}] 任务池添加成功 当前任务数${taskPool.length}`);
                        runTask();
                    });

                }

                p.then(()=>{
                    console.log(`[${city.name}] 新房列表 拉取完成`);
                    resolve();
                })
            });
        });
    }
}

function getList(list_url) { //二手房

    return function () {

        return new Promise(function (resolve, reject) {

            fetch(list_url, (err, red, body) => {
                if (err) {
                    console.log(err);
                    resolve();
                } else {

                    var $doc = $(body);
                    var $list = $doc.find('.loupan-list1-s0');

                    /* 分批传送 */

                    let details = [];

                    for (let i = 0; i < $list.length; i++) {

                        var $item = $list.eq(i);

                        let detail_url = $item.attr('href').replace(/loupan/ig, 'detail');

                        details.push(detail_url);

                    }

                    resolve(details);
                }
            });

        });

    }
}

function getDetail(detail_url, city) {

    var detailPromise = new Promise(function (resolve, reject) {
        // let detailPage = `http://m.fang.com/xf/${city}/${pageid}.htm`;

        fetch(detail_url, (err, res, body) => {

            if (err) {
                console.log(`[${city.name}] 详情页 ${detail_url} url分析失败 ${err}`);
                resolve();
                return;
            }

            body = $(body);
            var $doc = $(body);


            var name = "", //名称
                price = "", //价格
                cityname = city.name, //城市
                county = "", //区县
                tese = "", //特色
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

            console.log(`[${city.name}] 详情页 ${detail_url} 分析开始`);

            //名字
            name = $doc.find('h1.public-lpm2').text().trim().replace( /\n|\r|\t/g, "" );

            //得到区县
            var $quxian = $doc.find('.public-m5 a').slice(2);
            for (let i = 0; i < $quxian.length; i++) {
                county += $quxian.eq(i).text().trim().replace( /\n|\r|\t/g, "" );
            }

            //特色
            var $tese = $doc.find('.public-lpm4 span');
            for (var i = 0; i < $tese.length; i++) {
                tese += $tese.eq(i).text().trim().replace( /\n|\r|\t/g, "" ) + " ";
            }

            var $table = $doc.find('.lpm-section4-table.mt30')
            var $td = $table.find('td');

            function getTd(i){
                return $td.eq(i).text().trim().replace( /\n|\r|\t/g, "" )
            }

            var jiage = getTd(1),
            kaipanshijian = getTd(3),
            jiaofangshijian = getTd(5),
            shoulouchudianhua = getTd(7),
            loupandizhi = getTd(9),
            zhuangxiu = getTd(11),
            jianzhuleibie = getTd(13),
            guihuamianji = getTd(15),
            jianzhumianji = getTd(17),
            huxing = getTd(19),
            rongjilv = getTd(21),
            lvhualv = getTd(23),
            chanquan = getTd(25),
            hushu = getTd(27),
            cheweishu = getTd(29),
            wuyegongsi = getTd(31),
            wuyeleibie = getTd(33),
            wuyefei = getTd(35),
            kaifashang = getTd(37),
            xiaoshoudaili = getTd(39),
            gongchengjidu = getTd(41),
            yushouxuke = getTd(43),
            shoulouchu = getTd(45),
            fangwuchaoxiang = getTd(47),
            jianzhudanwei = getTd(49),
            dongshu = getTd(51),
            shigongdanwei = getTd(53);

            //户数
            var hushudata = $table.find('td:contains(规划户数)').next().text().trim().replace(/\n|\r|\t/g, "")
            if (hushudata.indexOf("总户数") > -1) {
                zonghushu = hushudata.split("总户数")[1].split("当期户数")[0];
            }
            if (hushudata.indexOf("当期户数") > -1) {
                dangqihushu = hushudata.split("当期户数")[1].split("总户数")[0];
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

            getMap(detail_url.replace(/detail/ig, 'loupan'))

            .then(function (mapData) {

                var houseData = [
                   name , //名称
                   cityname , //城市
                   county , //区县
                   jiage ,
                   kaipanshijian ,
                   jiaofangshijian ,
                   shoulouchudianhua ,
                   loupandizhi ,
                   zhuangxiu ,
                   jianzhuleibie ,
                   guihuamianji,
                   jianzhumianji ,
                   huxing,
                   rongjilv ,
                   lvhualv,
                   chanquan ,
                   hushu ,
                   cheweishu ,
                   wuyegongsi ,
                   wuyeleibie,
                   wuyefei,
                   kaifashang ,
                   xiaoshoudaili ,
                   gongchengjidu ,
                   yushouxuke ,
                   shoulouchu ,
                   fangwuchaoxiang,
                   jianzhudanwei,
                   dongshu ,
                   shigongdanwei ,
                   mapData.lng,
                   mapData.lat,
                   jianjie,
                   zhoubian,
                   detail_url,
                ]

                console.log(`[${city.name}] ${name}详情页抓取成功`);
                resolve(houseData);
            });

        });
    });

    return detailPromise;
    // return Promise.race( [ timeoutPromise( taskTimeout,()=>{ 
    //     console.log(`详情页 ${detail_url} 超时`)
    //     addErrPage(detail_url);
    // } ), detailPromise ] );

}

function getMap(map_url) { //得到经纬度
    return new Promise((resolve, reject) => {
        fetch(map_url, (err, res, body) => {

            var lng = "",
                lat = "";

            if (err) {
                console.log('错误 map页', map_url, '分析失败', err);
            } else {
                var lng_reg = /lng(\s)*=(\s)*['"]([^"']*)['"]/ig; //经度
                var lat_reg = /lat(\s)*=(\s)*['"]([^"']*)['"]/ig; //纬度

                var x_result = lng_reg.exec(body),
                    y_result = lat_reg.exec(body);

                if (x_result != null) {
                    lng = x_result[3];
                }
                if (y_result != null) {
                    lat = y_result[3];
                }
            }

            resolve({
                lng,
                lat
            });

        });
    });
}


function getTotalPage(url) {
    return new Promise((resolve, reject) => {
        fetch(url, (err, red, body) => {

            if (err) {
                console.log(err);
                totalPage = 1;

            } else {
                var $doc = $(body);

                var totalPage = parseInt($doc.find(".tg-rownum-num li").last().text());

                if (totalPage.toString() === 'NaN') {
                    totalPage = 1;
                }
            }

            resolve(totalPage);

        });
    })
}


function timeoutPromise(time, fn) {
    return new Promise((resolve, reject) => {
        setTimeout(function () {
            if (fn) {
                fn();
            }
            resolve();
        }, time);
    });
}


function makeJSON(data) {

    var dir = data.dir;
    var filename = data.filename;
    var datasouce = data.datasouce;
    var filepath = path.join(dir, filename);

    return new Promise((resolve, reject) => {

        fs.writeFile(filepath + '.json', JSON.stringify(datasouce, null, "\t"), function (err) {

            datasouce = null;
            if (err) {
                console.log(filename, '保存失败', err);
                reject(err);
            } else {
                console.log(filename, '保存成功');
                resolve();
            }
        });
    });
}


function makeXLSX(data) {

    var dir = data.dir;
    var filename = data.filename;
    var datasouce = data.datasouce;
    var filepath = path.join(dir, filename);

    var savedata = [
        [
            '小区名称',
            '城市',
            '区县',
            "单价", 
            "开盘时间", 
            "交房时间", 
            "售楼处电话", 
            "楼盘地址", 
            "装修状况", 
            "建筑形式", 
            "规划面积", 
            "建筑面积", 
            "主力户型", 
            "容  积 率", 
            "绿  化 率", 
            "房屋产权", 
            "规划户数", 
            "车  位 数", 
            "物业公司", 
            "物业类型", 
            "物  业 费", 
            "开  发 商", 
            "销售代理", 
            "工程进度", 
            "预售许可证", 
            "售楼处地址", 
            "房屋朝向", 
            "建筑设计单位", 
            "栋数", 
            "施工单位",
            "经度",
            "纬度"
        ]
    ].concat(datasouce);

    return new Promise(function (resolve, reject) {
        console.log(`正在生成${filename}`);
        var buffer = xlsx.build([{
            name: filename,
            data: savedata,
        }]); // returns a buffer 
        fs.writeFile(filepath + '.xlsx', buffer, 'binary', function (err) {

            savedata = null;
            if (err) {
                console.log(`完成 ${filename}保存失败 `, err);
                reject();
            } else {
                console.log(`完成 ${filename}保存成功 `);
                resolve();
            }

        });

    });

}

function fetch(url, cb) {

    var trycount = 3; //如果试3次都不上就放弃
    var count = 0;

    sendData();

    function sendData() {
        request({
            method: 'GET',
            uri: url,
            gzip: true,
            timeout: taskTimeout,
        }, (err, res, body) => {

            if (err) {
                count++;
                if (count === trycount) {
                    console.log(`错误  ${url} 经常尝试3次连接 依旧失败 ${err}`);
                    addErrPage(url);
                    cb(err, res, body);
                } else {
                    sendData();
                }
            } else {
                cb(err, res, body);
            }

        });
    }

}