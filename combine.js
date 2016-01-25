'use strict'
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

var citys = require('./sourcedata/citys.json');
var province = require('./sourcedata/province.json');

var PROVINCE_DIR = 'totaldata';


var startPostion = 0 ;
var pos = 0;

var accessfile = 'totaldata/total.mdb';

var ADODB = require('node-adodb'),
  connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${accessfile};`);
 
// 全局调试开关，默认关闭 
ADODB.debug = false;
 
// 不带返回的查询 
connection
  .execute('INSERT INTO test(test,test2) VALUES ("Newton", "Male")')
  .on('done', function (data){
    console.log(data);
  })
  .on('fail', function (err){
    // TODO 逻辑处理 
    console.log(err);
  });


fs.readdir('DATA', function(err, files) {

    var p = Promise.resolve();

  for(var i = 51 ; i < files.length ; i ++){
      p = p.then(write(files[i]));
  }

  p.then(()=>{
    console.log(`finish`);
  })
});


function write(name){

    return function(){
        return new Promise((resolve,reject)=>{
            var filename = path.join('DATA',name);
            console.log(`${name} read`);

            try{
                var obj = xlsx.parse(fs.readFileSync(filename)); // parses a buffer 
                var data = obj[0].data;


                var p = Promise.resolve();

                var tasks = [];
                for(var i = 1 ;  i <data.length ; i++){
                    tasks.push(insert(data[i]))
                    // if(tasks.length == 1000){
                    //     p = p.then(allinsert(tasks))
                    //     tasks = [];
                    // }
                }
                p.then(allinsert(tasks))
                .then(()=>{
                    resolve();
                })
            }
            catch(e){
                resolve();
            }
         

        });

    }

}

function allinsert(tasks){
    return function(){
        return Promise.all(tasks)
    }
}

function insert(item){
    return new Promise((resolve,reject)=>{
        let sql = `INSERT INTO data(小区名称,价格,城市,区县,小区特色,小区地址,物业类别,物业公司,物业地址,物业费,竣工时间,停车位,建筑类别,建筑面积,占地面积,当期户数,总户数,开发商,小区简介,周边信息,纬度,经度)VALUES('${item[0]}','${item[1]}','${item[2]}','${item[3]}','${item[4]}','${item[5]}','${item[6]}','${item[7]}','${item[8]}','${item[9]}','${item[10]}','${item[11]}','${item[12]}','${item[13]}','${item[14]}','${item[15]}','${item[16]}','${item[17]}','${item[18]}','${item[19].replace("'", "''")}','${item[20]}','${item[21]}')`;
        connection
          .execute(sql)
          .on('done', function (data){
            console.log(`${item[2]} ${item[0]} success`);
            resolve();
          })
          .on('fail', function (err){
            // TODO 逻辑处理 
            console.log(err);
            console.log(sql);
            resolve();
          });
    });
}