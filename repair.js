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

var citys = require('./citys.json');
var province = require('./province.json');

var dir_name = "DATA";


var p = Promise.resolve();


fs.readdir(dir_name, function(err, files) {

    for(var i = 0 ; i < files.length ; i ++){
        p = p.then(change(files[i]));
    }

});

function change(name){

    return function(){
        return new Promise((resolve,reject)=>{
            var filename = path.join(dir_name,name);
            console.log(`${name} read`);

            var obj = xlsx.parse(fs.readFileSync(filename)); // parses a buffer 
            var row = obj[0].data[0];
            row[11] = "停车位";
            row[17] = "开发商";
            row[20] = "纬度";
            row[21] = "经度";

            var buffer = xlsx.build([obj[0]]); // returns a buffer

            fs.writeFile(filename, buffer, 'binary', function (err) {

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

}