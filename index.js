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


var citys = require('./citys.json');
var province = require('./province.json');

var cookie = 'global_cookie=h0i9n5i88xadjb5wtv51ub8bj2vijc8k9cp; new_search_uid=cfe6d014e48b7504f837679c7a9d3efb; searchLabelN=3_1452653837_34434%5B%3A%7C%40%7C%3A%5D0e65b2add0697bd4d1f5d9393d1d5df0; searchConN=3_1452653837_35112%5B%3A%7C%40%7C%3A%5D5b2ece6c9c77452e0ba99353ebbd8c41; global_wapandm_cookie=47vbaoxdx3qx589nj84ja3jhp2pijc9aoyx; showHongbao_1211238844=1; showAdsh=1; showHongbao_1211184600=1; newhouse_chat_guid=60603D6A-DFF5-7C69-8215-0C128E1439BC; jiatxShopWindow=1; sf_source=; showAdsz=1; showHongbao_2810836906=1; showHongbao_2811093454=1; showHongbao_2811209174=1; showHongbao_1211041900=1; showHongbao_1210472542=1; vh_newhouse=3_1452741988_938%5B%3A%7C%40%7C%3A%5Db0155f734e792699b3704fb6e29f26c1; vh_shop=3_1452751247_7974%5B%3A%7C%40%7C%3A%5D3795578a6c0bcd5d8c001dcafd20fd80; newhouse_ac=3_1452746167_3628%5B%3A%7C%40%7C%3A%5Df5022c64b5e1f14ca19719d3a2e0f13c; token=6e7ce5b692a649049ff59dade5f80d51; city=sz; newhouse_user_guid=3A73B66E-D417-A86C-5E78-FD43485C661F; __utmt_t0=1; __utmt_t1=1; __utmt_t2=1; __utma=147393320.1114305379.1452653794.1452741954.1452746112.3; __utmb=147393320.318.10.1452746112; __utmc=147393320; __utmz=147393320.1452653794.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); unique_cookie=U_4r4o6bm3b9b5toehu9mp23nhj2xijdrixy8*59';

var startPage = 1;
var maxPage = 100;
var citylength = 100;
var maxTasksLength = 20; /* 确保同时发起的http链接不超过10个 */
var timeout = 5000; //如果5s还没打开页面 
var maskPageTaskLength = 10; //同时抓取页面的长度

var totalcount = 0;
var taskTimeout = 15000; //如果一个任务15秒还没完成 就继续退出这个任务

var province_length = province.length;

var p = Promise.resolve();

for (let i = 0; i < province_length ; i++) {
	p = p.then(getProvince(province[i]));
};

p.then(function () {
	console.log(totalcount);
});

/* test */

// getDetail( 'http://hujinghuayuan0755.fang.com', citys[ 0 ], [] );

var nowCity = "";
var nowProvince = "";
var nowPage = "";
var nowCityData = [];
var nowProvinceData = [];


// process.on('SIGINT', function() {
//   makeJSON(['backup',nowCity+"-"+nowPage,nowCityData])
//   .then(function(){
//   	return makeJSON(['backup',`${nowProvince}-${nowCity}-${nowPage}`,nowProvinceData]);
//   });
// });
// process.on('exit',function(code){ //意外退出时保存

// 	console.log(code);
// 	makeJSON(['backup',nowCity+"-"+nowPage,nowCityData])
// 	.then(function(){
// 		return makeJSON(['backup',`${nowProvince}-${nowCity}-${nowPage}`,nowProvinceData]);
// 	});
// });

var errpage = [];

function addErrPage(url) {

	errpage.push(url);

}

function fetch(url, option, cb) {

	var trycount = 3; //如果试3次都不上就放弃
	var count = 0;

	var defaultOption = Object.assign({
		encoding: 'gb2312',
		compressed: true,
		open_timeout: timeout,
	}, option);

	sendData();

	function sendData() {
		n.get(url, defaultOption, (err, res, body) => {

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

function getProvince(province) {

	return function () {

		return new Promise((resolve, reject) => {
			console.log(`开始 分析${province.name}省的数据`);

			var province_data = [];

			nowProvince = province.name;
			nowProvinceData = province_data;

			var rejectHandler = function (err) {
				console.log(err);
				return makeJSON(['','backup',nowProvinceData]);
			}

			var citys = province.citys;
			var citylength = citys.length;
			var p = Promise.resolve();
			for (var i = 0; i < citylength; i++) {

				p = p.then(getCityData(citys[i]))
					.then( (data) => {
						var city = data[0];
						var citysdata = data[1];
						var dir = 'city';
						province_data = province_data.concat(citysdata);

						return Promise.all([
							makeJSON([dir, city.name, citysdata]),
							makeJSON(['city',city.name + '-' + 'error' ,errpage])
						]);

					})

					.then( ()=> {
						errpage = []; //清空errpage
					}, rejectHandler );

					// .then(makeXLSX, rejectHandler);
			}

			p.then(function () {
				var dir = 'province';
				totalcount += province_data.lenght;
				return makeJSON([dir, province.name, province_data]);
			},rejectHandler)

			.then(function(){
				console.log('\n',province.name,'拉取成功');
				resolve();
			});
				// .then(makeXLSX, rejectHandler)

		});

	}

}

function getTotalPage(url) {
	return new Promise((resolve, reject) => {
		fetch(url, {
			encoding: 'gb2312',
			compressed: true //一定要开启gzip
		}, (err, red, body) => {

			if (err) {
				console.log(err);
				resolve(maxPage);
				return;
			}

			var $doc = $(body);
			var $pages = $doc.find(".page .fr a");

			var totalPage = parseInt($pages.eq($pages.length - 3).text());

			if (totalPage.toString() === 'NaN') {
				totalPage = maxPage;
			}
			resolve(totalPage);

		});
	})
}

function getCityData(city) {

	return function () {

		return new Promise(function (resolve, reject) {

			console.log(`开始 拉取${city.name}的数据`);

			var citysdata = []; //储存每个城市的数据

			nowCity = citysdata;
			var page = 1;

			var p = Promise.resolve();

			p.then(function () {
				if (city.sname !== 'bj') {
					var url = `http://newhouse.${city.sname}.fang.com/house/s/`;
				} else {
					var url = `http://newhouse.fang.com/house/s/`;
				}
				return getTotalPage(url);
			}).then(function (totalPage) {

				console.log(`${city.name} 共有 ${totalPage} 页`);
				var p = Promise.resolve();

				for (let page = startPage; page <= totalPage && page <= maxPage ; page++) {

					nowPage = page;

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
					})
				.catch(function(e){
					console.log("程序错误",e);
					resolve([city, citysdata]);
					console.log(`完成 拉取${city.name}的数据`);
				});
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


			fetch(url, {
				encoding: 'gb2312',
				compressed: true,
				out_timeout: timeout,
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

						var detailUrl_queue = [];
						var len = $list.length;

						for (let i = 0; i < len; i += maxTasksLength) {

							let queue_index = i / maxTasksLength;

							detailUrl_queue[queue_index] = [];

							for (let j = i; j < maxTasksLength + i && j < len; j++) {

								var $item = $list.eq(j);
								var $h4 = $item.find('h4');
								var $link = $h4.find('a'); //找到去下个页面的a标签

								var detailUrl = $link.attr('href').trim();
								detailUrl_queue[queue_index].push(detailUrl);
							}

						}

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
						console.log(`\r\n完成 分析${city.name}第${page}页\r\n`);
						resolve([city, datasouce]);
					});

				}
			});

		});

	}
}


function timeoutPromise(time){
	return new Promise((resolve,reject) =>{
		setTimeout(function(){
			resolve();
		},time);
	});
}


function getDetail(detailUrl, city, datasouce) {

	var detailPromise = new Promise(function (resolve, reject) {
		// let detailPage = `http://m.fang.com/xf/${city}/${pageid}.htm`;

		fetch(detailUrl, {
			encoding: 'gb2312',
			compressed: true,
			open_timeout: timeout,
		}, (err, res, body) => {

			if (err) {
				console.log(`错误 中转页 ${detailUrl} url分析失败 ${err}`);
				addErrPage(detailUrl);
				resolve();
				return;
			}

			body = $(body);
			var $doc = $(body);


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

			console.log(`开始 中转页 ${detailUrl} 分析`);

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

			var $gaikuang = $doc.find(".XQgaikuang");

			if ($gaikuang.length > 0) {

				houseData.tingchewei = $gaikuang.find("strong:contains(停y车y位)").parent().contents().eq(1).text().trim(); //停车位
				houseData.wuyegongsi = $gaikuang.find("strong:contains(物业公司)").parent().contents().eq(1).text().trim(); //物业公司
				houseData.wuyedizhi = $gaikuang.find("strong:contains(小区地址)").parent().contents().eq(1).text().trim();

				var infoUrl = $gaikuang.prev().find(".more a").attr("href");

				console.log(infoUrl);
				getInfo2(infoUrl, houseData)
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

			} else if ($doc.find('#iframe_map').length > 0) {

				var infoUrl = $doc.find(".information_li .more p a").attr("href") ||
					$doc.find(".cd_right_nr1_Ub .cd_fir_xx_a.FL").first().find("li").last().find("a").attr("href");
				var mapUrl = $doc.find('#iframe_map').attr("src");

				if (!infoUrl || !mapUrl) {
					console.log(`错误 中转页 ${detailUrl} url分析失败 `);
					resolve();
					return;
				} 

				infoUrl = url.resolve(detailUrl, infoUrl);


				Promise.all([getMap(mapUrl, houseData), getInfo(infoUrl, houseData)])
					.then(() => {
						datasouce.push([
							houseData.name.replace(/\n|\r|\t/g,""), //名称
							houseData.price.replace(/\n|\r|\t/g,""), //价格
							houseData.cityname.replace(/\n|\r|\t/g,""), //城市
							houseData.county.replace(/\n|\r|\t/g,""), //区县
							houseData.address.replace(/\n|\r|\t/g,""), //'小区地址'
							houseData.wuyeleibie.replace(/\n|\r|\t/g,""), //物业类别.replace(/\n|\r|\t/g,""),
							houseData.wuyegongsi.replace(/\n|\r|\t/g,""), //物业公司
							houseData.wuyedizhi.replace(/\n|\r|\t/g,""), //物业地址
							houseData.wuyefei.replace(/\n|\r|\t/g,""), //物业费
							houseData.jungongshijian.replace(/\n|\r|\t/g,""), //竣工时间.replace(/\n|\r|\t/g,""),
							houseData.kaifashang.replace(/\n|\r|\t/g,""), //开发商
							houseData.jianzhuleibie.replace(/\n|\r|\t/g,""), //建筑类别
							houseData.zhandimianji.replace(/\n|\r|\t/g,""), //建筑面积	占地面积
							houseData.dangqihushu.replace(/\n|\r|\t/g,""), //当期户数.replace(/\n|\r|\t/g,""),
							houseData.zonghushu.replace(/\n|\r|\t/g,""), //总户数
							houseData.tingchewei.replace(/\n|\r|\t/g,""), //停车位
							houseData.jianjie.replace(/\n|\r|\t/g,""), //小区简介
							houseData.zhoubian.replace(/\n|\r|\t/g,""), //周边信息
							houseData.lat, //精度
							houseData.lng //维度
						]);
						resolve(houseData.name); //返回数据
					}, (err) => {
						console.log(`错误 中转页 ${detailUrl} 分析失败 ${err}`);
						resolve();
					});

			} else if($doc.find('.plptinfo_txt').length > 0){

				let $baseinfo = $doc.find('.plptinfo_txt');
				let $table = $baseinfo.find('.plptinfo_list.clearfix ul');
				houseData.tingchewei = $table.find("strong:contains(停y车y位)").parent().contents().eq(1).text().trim(); //停车位
				houseData.wuyegongsi = $table.find("strong:contains(物业公司)").parent().contents().eq(1).text().trim(); //物业公司
				houseData.wuyedizhi = $table.find("strong:contains(小区地址)").parent().contents().eq(1).text().trim();

				var infoUrl = $baseinfo.find(".more").attr("href");

				getInfo2(infoUrl, houseData)
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

			} else {

				var newcode_reg = /newcode=([^=]*)[\&'"\)]/ig;

				var result = newcode_reg.exec(body); //读移动端页面

				if(result){

					let newcode =result[1];
					let detailUrl = 'http://m.fang.com/xf/' + city.sname + '/' +  newcode + '.htm'
					getMoblieDetail(detailUrl, city,houseData)
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


				}else{
					console.log(`错误 未知类型 ${detailUrl}的中转页`);
					resolve();
				}

			}


		});
	});


	return Promise.race([timeoutPromise(taskTimeout),detailPromise]);

}

function getMap(url, houseData) { //得到经纬度
	return new Promise((resolve, reject) => {
		fetch(url, {
			encoding: 'utf-8',
			open_timeout: timeout,
			compressed: true,
		}, (err, res, body) => {

			if (err) {
				console.log('错误 类型1的map页',url,'分析失败',err);
				resolve();
				return;
			}

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
		fetch(url, {
			encoding: 'utf-8',
			open_timeout: timeout,
		}, (err, res, body) => {

			if (err) {
				console.log('错误 类型1的info页',url,'分析失败',err);
				resolve();
				return;
			}

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

function getMap2(url, houseData) {

	return new Promise((resolve, reject) => {

		fetch(url, {
			encoding: 'GBK',
			open_timeout: timeout,
			compressed: true,
		}, (err, res, body) => {

			if (err) {
				console.log('错误 类型2的map页',url,'分析失败',err);
				resolve();
				return;
			}

			var mapx_reg = /"px":"([^"]*)"/ig;
			var mapy_reg = /"py":"([^"]*)"/ig;

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

function getInfo2(infoUrl, houseData) {


	return new Promise(function (resolve, reject) {

		fetch(infoUrl, {
			encoding: 'gb2312',
			compressed: true,
			open_timeout: timeout,
		}, (err, res, body) => {

			if (err) {
				console.log('错误 类型2的info页',url,'分析失败',err);
				resolve();
				return;
			}

			var $doc = $(body);

			var $lbox = $doc.find(".lbox");

			var $baseinfo = $doc.find("#xq_jbxx_anchor").parent().parent().next();
			var $jianjie = $doc.find("#xq_xqjj_anchor").parent().parent().next();
			var $zhoubian = $doc.find("#xq_zbxx_anchor").parent().parent().next();
			var $peitao = $doc.find("#xq_ptss_anchor").parent().parent().next();
			var $xianguanxinxi = $doc.find("#xq_xgxx_anchor").parent().parent().next();

			var mapUrl = $doc.find("#xq_dlwz_anchor").parent().parent().next().find("iframe").attr("src") || "";

			houseData.name = $doc.find(".maininfo .leftinfo .ewmBoxTitle .floatl").text().trim(); //名称
			houseData.price = $doc.find(".pred.pirceinfo").eq(0).text().trim(); //价格

			houseData.county = $baseinfo.find("strong:contains(所属区域)").parent().contents().eq(1).text().trim(); //区县
			houseData.address = $baseinfo.find("strong:contains(小区地址)").parent().contents().eq(1).text().trim(); //'小区地址'
			houseData.wuyeleibie = $baseinfo.find("strong:contains(物业类别)").parent().contents().eq(1).text().trim(); //物业类别 
			// houseData. // wuyegongsi = $xianguanxinxi.find( "strong:contains(代理商：)" ).parent().contents().eq( 1 ).text().trim(); //物业类别 
			// houseData. // wuyedizhi = "", //物业地址
			houseData.wuyefei = $baseinfo.find("strong:contains(物 业 费 )").parent().contents().eq(1).text().trim(); //物业费
			houseData.jungongshijian = $baseinfo.find("strong:contains(竣工时间)").parent().contents().eq(1).text().trim(); //竣工时间
			houseData.kaifashang = $baseinfo.find("strong:contains(开 发 商)").parent().contents().eq(1).text().trim(); //开发商
			houseData.jianzhuleibie = $baseinfo.find("strong:contains(建筑类别)").parent().contents().eq(1).text().trim(); //建筑类别
			houseData.jianzhumianji = $baseinfo.find("strong:contains(建筑面积)").parent().contents().eq(1).text().trim(); //建筑面积	
			houseData.zhandimianji = $baseinfo.find("strong:contains(占地面积)").parent().contents().eq(1).text().trim(); //占地面积
			houseData.dangqihushu = $baseinfo.find("strong:contains(当期户数)").parent().contents().eq(1).text().trim(); //当期户数 
			houseData.zonghushu = $baseinfo.find("strong:contains(总 户 数)").parent().contents().eq(1).text().trim(); //总户数
			// houseData. // tingchewei = $peitao.find( "string:contains(停 车 位：)" ).parent().contents().eq( 1 ).text().trim(); //停车位
			houseData.jianjie = $jianjie.text().trim(); //小区简介
			houseData.zhoubian = $zhoubian.text().trim(); //周边信息
			// lat = "", //精度
			// lng = ""; //维度

			getMap2(mapUrl, houseData)
				.then(function () {
					resolve(); //返回数据
				}, function (err) {
					reject();
				});


		});

	});
}

function getMoblieDetail(detailUrl, city,houseData) {

	return new Promise(function (resolve, reject) {
		// let detailPage = `http://m.fang.com/xf/${city}/${pageid}.htm`;
		console.log(`正在加载${detailUrl}`);
		fetch(detailUrl,{
			encoding : 'GBK'
		}, function (err, res, body) {
			if(err){
				console.log(err);
				reject();
				return ;
			}
			console.log(`移动端页面 ${detailUrl}加载成功`);

			var $doc = $(body);

			houseData.name = $doc.find('#projname').text().trim();

			if(houseData.name === ''){
				console.log(`移动端页面 ${detailUrl} 没有获取到name`);
				reject();
				return ;
			}

			houseData.price = $doc.find('#price').text().trim();
			var $info = $doc.find("#flextableID");
			var $kaipan = $doc.find("#wapxfxqy_B02_19")
			houseData.kaipan = $kaipan.find("p").text();
			houseData.addressr = $kaipan.next().find("p").text().trim(); //小区地址
			houseData.jianjie = $doc.find(".stag").text(); // 小区简介
			houseData.jungongshijian = $info.find(':contains(竣工时间)').find('p').text(); //入住时间
			houseData.wuyeleibie = $info.find(':contains(物业类型').find('p').text(); //物业类型
			houseData.jianzhuleibie = $info.find(':contains(建筑类别)').find('p').text(); //建筑类别
			houseData.zhuhushu = $info.find(':contains(住户数)').find('p').text();
			houseData.tingchewei = $info.find(':contains(停车位)').find('p').text();
			houseData.kaifashang = $info.find(':contains(开发商)').find('p').text();
			houseData.wuyegongsi = $info.find(':contains(物业公司)').find('p').text();
			houseData.wuyefei = $info.find(':contains(物业费)').find('p').text();
			var pos = querystring.parse($doc.find("#drivedaohang").attr("href"));
			houseData.lat = pos.mapx; //纬度
			houseData.lng = pos.mapy; //精度

			resolve();

		});
	});

}


function makeJSON(data){

	var dir = data[0];
	var filename = data[1] + '.json';
	var datasouce = data[2];
	var filepath = path.join(dir,filename);

	console.log(filepath);
	return new Promise((resolve,reject)=>{


		
		fs.writeFile(filepath, JSON.stringify(datasouce, null, "\t"), function (err) {
			if (err) {
				console.log(filename, '保存失败', err);
				reject(err);
			}else{
				console.log(filename,'保存成功');
				resolve();
			}
		});
	});
}

function makeXLSX(data) {

	var dir = data[0];
	var filename = data[1];
	var datasouce = data[2];

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
	].concat(datasouce);

	console.log(savedata.length);
	console.log(savedata[0]);
	console.log(savedata[1]);

	return new Promise(function (resolve, reject) {
		var file = `${filename}.xlsx `;
		console.log(`正在生成${filename}`);
		var buffer = xlsx.build([{
			name: filename,
			data: savedata,
		}]); // returns a buffer 
		fs.writeFile(path.join(file), buffer, 'binary', function (err) {
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