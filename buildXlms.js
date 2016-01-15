'use strict';

var xlsx = require('node-xlsx');
var fs = require('fs');
var path = require('path');

var citys = require('./citys.json');
var province = require('./province.json');


var yinchuan = require('./city/银川.json');

yinchuan.unshift(
    ['小区名称',
        '价格',
        '城市',
        '区县',
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
);

var savedata = [
    ['小区名称',
        '价格',
        '城市',
        '区县',
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
];

console.log(savedata);
var filename = `银川.xlsx `;
var buffer = xlsx.build([{
    name: filename,
    data: savedata,
}]); // returns a buffer 
fs.writeFile(path.join('cityxlsx',filename), buffer, 'binary', function (err) {
    if (err) {
        console.log(`完成 ${filename}保存失败 `, err);
    } else {
        console.log(`完成 ${filename}保存成功 `);
    }

});