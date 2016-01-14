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

var citys = require('./citys.json');
var province = require('./province.json');

var cookie = 'sf_source=; showAdsz=1; global_cookie=mmyoq0nvjm3b6nomeo0su7b4j1miinhjvht; new_search_uid=6587d72cbd928ba835ce8caeef364e8a; searchLabelN=3_1451157289_4139%5B%3A%7C%40%7C%3A%5D688bf65f6092439f0a0aaa4751a9e35a; searchConN=3_1451157289_4215%5B%3A%7C%40%7C%3A%5D2405ab12090db05f446d3eceee1f6a62; showHongbao_2811177428=1; newhouse_chat_guid=07BD3160-DD51-02BB-D2C3-D8B20E629452; jiatxShopWindow=1; showHongbao_2811108546=1; city=sz; newhouse_user_guid=95DF57DF-67F7-202F-21B4-327BB25A4911; vh_newhouse=3_1451157318_4037%5B%3A%7C%40%7C%3A%5Ddca085e94cc389b0d0432464ba2e4053; token=168377986b3d4a42a41e0b6508d70b70; __utma=147393320.1140864039.1451157239.1451157239.1451165205.2; __utmb=147393320.5.10.1451165205; __utmc=147393320; __utmz=147393320.1451165205.2.2.utmcsr=newhouse.sz.fang.com|utmccn=(referral)|utmcmd=referral|utmcct=/; unique_cookie=U_mmyoq0nvjm3b6nomeo0su7b4j1miinhjvht*15; JSESSIONID=aaazfZ3x7NMui4-v-qGhv; global_wapandm_cookie=xm1hgyh5kg90a42l9k1brpsso5qiinn3161; __utmmobile=0x59f1369b7c5a60a6; mencity=sz; unique_wapandm_cookie=U_xm1hgyh5kg90a42l9k1brpsso5qiinn3161*5';

var startPage = 1;
var maxPage = 50;
var citylength = 100;
var maxTasksLength = 10;
var maskPageTaskLength = 10; //同时抓取页面的长度

var totalcount = 0;



var p = Promise.resolve();

for (let i = 0; i < 1; i++) {
	p = p.then(getProvince(province[i]));
};

p.then(function () {
	console.log(totalcount);
});



function getProvince(province) {

	return function () {

		return new Promise((resolve, reject) => {
			console.log(`开始 分析${province.name}省的数据`);

			var province_datasouce = [];

			var citys = province.citys;
			var p = Promise.resolve();
			for (var i = 0; i < citylength; i++) {
				p = p.then(getCityData(citys[i]))
					.then(function (data) {
						var city = data[0];
						var citysdata = data[1];
						var dir = 'city';
						province_datasouce = province_datasouce.concat(citysdata);
						return Promise.resolve([dir, city.name, citysdata]);
					})
					.then(makeXLSX());
			}
			p.then(function () {
				var dir = 'province/';
				return Promise.resolve([province, province.name, province_datasouce]);
			})
			p.then(makeXLSX());

		});

	}

}


function getCityData(city) {

	return function () {

		return new Promise(function (resolve, reject) {

			console.log(`开始 拉取${city.name}的数据`);

			var citysdata = []; //储存每个城市的数据

			var page = 1;

			var p = Promise.resolve();

			for (let page = startPage; page <= maxPage; page++) {

				p = p.then(getList(city, page, citysdata), failHandler)

			}


			function failHandler(err) {
				console.log(err);
			}

			p.then(function () {
					resolve([city, citysdata]);
					console.log(`完成 拉取${city.name}的数据`);
				},
				function () {
					resolve([city, citysdata]);
					console.log(`完成 拉取${city.name}的数据`);
				});


		});

	}

}


function getList(city, page, datasouce) {

	return function () {

		return new Promise(function (resolve, reject) {

			if (city.sname !== 'bj') {
				var url = `http://newhouse.${city.sname}.fang.com/house/s/b9${page}/`;
			} else {
				var url = `http://newhouse.fang.com/house/s/b9${page}/`;
			}

			n.get(url, {
				encoding: 'gb2312'
			}, (err, red, body) => {
				if (err) {
					console.log(err);
					resolve();
				} else {

					console.log(`\r\n开始 分析${city.name}第${page}页\r\n`);
					var $doc = $(body);
					var $list = $doc.find('.contentList');

					var tasks = [];

					/* 分批传送 */

					if ($list.length != 0) {
						$list.each(function () {
							var $item = $(this);
							var $h4 = $item.find('h4');
							var $link = $h4.find('a'); //找到去下个页面的a标签

							var name = $link.text();
							var detailUrl = $link.attr('href').trim();

							tasks.push(getDetail(detailUrl, city, datasouce));
						});
					} else {

						$list = $doc.find('.nlc_details');

						var detailUrl_queue = [];
						var len = $list.length;

						for (let i = 0; i < len; i += maxTasksLength) {

							let queue_index = i / maxTasksLength;

							detailUrl_queue[queue_index] = [];

							for (let j = i; j < maxTasksLength + i && j < len; j++) {

								var $item = $list.eq(j);
								var $name = $item.find('.nlcd_name');
								var $link = $name.find("a"); //找到去下个页面的a标签

								var detailUrl = $link.attr('href').trim();
								detailUrl_queue[queue_index].push(detailUrl);
							}

						}
					}

					var p = Promise.resolve();

					detailUrl_queue.forEach((detailUrls, i) => {
						p = p.then(() => {

							var tasks = detailUrls.map((detailUrl) => {
								return getDetail(detailUrl, city, datasouce);
							});

							return Promise.all(tasks).then((name) => {
								console.log(`完成 ${name}抓取完成`)
							}, (url) => {
								console.log(`失败 ${url}分析失败`);
							});
						});
					});

					p.then(function () {
						console.log(`完成 分析${city.name}第${page}页\r\n\r\n`);
						resolve([city, datasouce]);
					});

				}
			});

		});

	}
}


function getDetail(detailUrl, city, datasouce) {

	return new Promise(function (resolve, reject) {
		// let detailPage = `http://m.fang.com/xf/${city}/${pageid}.htm`;

		n.get(detailUrl, {
			encoding: 'gb2312'
		}, (err, res, body) => {
			body = $(body);
			var $doc = $(body);

			var infoUrl = $doc.find(".information_li .more p a").attr("href") ||
				$doc.find(".cd_right_nr1_Ub .cd_fir_xx_a.FL").first().find("li").last().find("a").attr("href");
			var mapUrl = $doc.find('#iframe_map').attr("src");

			if (!infoUrl || !mapUrl) {
				console.log(`错误 中转页 ${detailUrl} url分析失败 `);
				resolve();
				return;
			} else {
				console.log(`开始 中转页 ${detailUrl} 分析`);
			}


			var name = "", //名称
				price = "", //价格
				cityname = city.name, //城市
				county = "", //区县
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
				lat = "", //精度
				lng = ""; //维度


			//初始化数据 
			var houseData = {
				name, //名称
				price, //价格
				cityname, //城市
				county, //区县
				address, //'小区地址',
				wuyeleibie, //物业类别,
				wuyegongsi, //物业公司
				wuyedizhi, //物业地址
				wuyefei, //物业费
				jungongshijian, //竣工时间,
				kaifashang, //开发商
				jianzhuleibie, //建筑类别
				zhandimianji, //建筑面积	占地面积
				dangqihushu, //当期户数,
				zonghushu, //总户数
				tingchewei, //停车位
				jianjie, //小区简介
				zhoubian, //周边信息
				lat, //精度
				lng //维度
			}

			Promise.all([getMap(mapUrl, houseData), getInfo(infoUrl, houseData)])
				.then(() => {
					datasouce.push([
						houseData.name, //名称
						houseData.price, //价格
						houseData.cityname, //城市
						houseData.county, //区县
						houseData.address, //'小区地址',
						houseData.wuyeleibie, //物业类别,
						houseData.wuyegongsi, //物业公司
						houseData.wuyedizhi, //物业地址
						houseData.wuyefei, //物业费
						houseData.jungongshijian, //竣工时间,
						houseData.kaifashang, //开发商
						houseData.jianzhuleibie, //建筑类别
						houseData.zhandimianji, //建筑面积	占地面积
						houseData.dangqihushu, //当期户数,
						houseData.zonghushu, //总户数
						houseData.tingchewei, //停车位
						houseData.jianjie, //小区简介
						houseData.zhoubian, //周边信息
						houseData.lat, //精度
						houseData.lng //维度
					]);
					resolve(houseData.name); //返回数据
				}, (err) => {
					console.log(`错误 中转页 ${detailUrl} 分析失败 ${err}`);
					resolve();
				});

		});
	});

}

function getMap(url, houseData) { //得到经纬度
	return new Promise((resolve, reject) => {
		n.get(url, {
			encoding: 'utf-8'
		}, (err, res, body) => {
			var mapx_reg = /"mapx":"([^"]*)"/ig;
			var mapy_reg = /"mapy":"([^"]*)"/ig;

			var x_result = mapx_reg.exec(body),
				y_result = mapy_reg.exec(body);

			if (x_result != null) {
				houseData.lng = x_result[1];
			}
			if (y_result != null) {
				houseData.lat = y_result[1];
			}
			resolve();
		});
	});
}

function getInfo(url, houseData) { //得到信息
	return new Promise((resolve, reject) => {
		n.get(url, {
			encoding: 'utf-8'
		}, (err, res, body) => {
			var $doc = $(body);

			//得到楼盘
			houseData.county = $doc.find('#xfzxxq_B01_03 p a').eq(2).text().replace(/楼盘/ig, "");

			//得到名字
			houseData.name = $doc.find('.ts_linear').text();


			var $form = $doc.find('.besic_inform');
			var $table = $form.find('table');

			houseData.price = $table.find('.currentPrice').text().trim();
			houseData.address = $table.find("strong:contains(售楼地址)").parent().contents().eq(1).text().trim();
			houseData.wuyeleibie = $table.find("strong:contains(物业类别)").parent().contents().eq(1).text().trim();
			houseData.wuyefei = $table.find("strong:contains(物 业 费 )").parent().contents().eq(1).text().trim();
			houseData.wuyedizhi = $table.find("strong:contains(物业地址)").parent().contents().eq(1).text().trim();
			houseData.wuyegongsi = $table.find("strong:contains(物业公司)").parent().contents().eq(1).text().trim();
			houseData.jianzhuleibie = $table.find("strong:contains(建筑类别)").parent().contents().eq(1).text().trim();
			houseData.kaifashang = $table.find("strong:contains(开 发 商 )").next().text().trim().replace(/\[房企申请入驻\]/ig, "");

			houseData.tingchewei = $form.find("#xq_cwxx_anchor").next().text().trim();
			houseData.jianjie = $form.find("#xq_xmjs_anchor").next().text().trim();
			houseData.zhoubian = $form.find("#xq_xmpt_anchor").next().text().trim();

			var $otherinfo = $form.find("#xq_xgxx_anchor").next().contents();

			houseData.zhandimianji = $otherinfo.eq(2).text().trim();
			// houseData.jianzhumianji = $otherinfo.eq(6).text().trim();
			houseData.jungongshijian = $otherinfo.eq(14).text().trim();

			var hushudata = $otherinfo.eq($otherinfo.length - 3).text().trim();

			hushudata.split(' ').forEach((hushu, i) => {
				if (hushu.indexOf("总户数") > -1) {
					houseData.zonghushu = hushu;
				}

				if (hushu.indexOf("当期户数") > -1) {
					houseData.dangqihushu = hushu;
				}
			});

			resolve();

		});
	});
}

function makeXLSX() {
	return function (data) {
		var dir = data[0];
		var filename = data[1];
		var datasouce = data[2];
		datasouce.unshift(
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
				'建筑面积	占地面积',
				'当期户数',
				'总户数',
				'停车位',
				'小区简介',
				'周边信息',
				'经度',
				'纬度'
			]);

		return new Promise(function (resolve, reject) {
			var file = `${filename}.xlsx`;
			console.log(`正在生成${filename}`);
			var buffer = xlsx.build([{
				name: filename,
				data: datasouce
			}]); // returns a buffer 
			fs.writeFileSync(path.join(dir, file), buffer, 'binary');
			console.log(`完成 ${filename}保存成功`);
			resolve();
		});
	}
}