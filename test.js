'use strict';

var request = require( 'request' );
var xlsx = require( 'node-xlsx' );
var $ = require( 'cheerio' );
var Promise = require( 'bluebird' );
var iconv = require('iconv-lite');
// var Iconv = require( 'iconv' ).Iconv;
var fs = require( 'fs' );
var querystring = require( "querystring" );
var citys = require( './citys.json' );

var url = 'http://guanlanhuihz.fang.com/house/2811261634/housedetail.htm';
var cookie = 'sf_source=; showAdsz=1; global_cookie=mmyoq0nvjm3b6nomeo0su7b4j1miinhjvht; new_search_uid=6587d72cbd928ba835ce8caeef364e8a; searchLabelN=3_1451157289_4139%5B%3A%7C%40%7C%3A%5D688bf65f6092439f0a0aaa4751a9e35a; searchConN=3_1451157289_4215%5B%3A%7C%40%7C%3A%5D2405ab12090db05f446d3eceee1f6a62; showHongbao_2811177428=1; newhouse_chat_guid=07BD3160-DD51-02BB-D2C3-D8B20E629452; jiatxShopWindow=1; showHongbao_2811108546=1; city=sz; newhouse_user_guid=95DF57DF-67F7-202F-21B4-327BB25A4911; vh_newhouse=3_1451157318_4037%5B%3A%7C%40%7C%3A%5Ddca085e94cc389b0d0432464ba2e4053; token=168377986b3d4a42a41e0b6508d70b70; __utma=147393320.1140864039.1451157239.1451157239.1451165205.2; __utmb=147393320.5.10.1451165205; __utmc=147393320; __utmz=147393320.1451165205.2.2.utmcsr=newhouse.sz.fang.com|utmccn=(referral)|utmcmd=referral|utmcct=/; unique_cookie=U_mmyoq0nvjm3b6nomeo0su7b4j1miinhjvht*15; JSESSIONID=aaazfZ3x7NMui4-v-qGhv; global_wapandm_cookie=xm1hgyh5kg90a42l9k1brpsso5qiinn3161; __utmmobile=0x59f1369b7c5a60a6; mencity=sz; unique_wapandm_cookie=U_xm1hgyh5kg90a42l9k1brpsso5qiinn3161*5';

// var iconv = new Iconv('GBk', 'utf-8');


var n = require('needle');

n.get(url,
        {encoding:'gb2312'},
         function(error,response,body){
      //乱码？非也，这是因为win的控制台是gbk编码，如果是unix控制台就
      console.log(body.toString());
});

'use strict';
var baseclass = "#sffamily_B03_";

var data = [];

for(var i = 1 ; i < 29 ; i ++ ){

    if(i < 10){
        i = "0" + i;
    }
    var id = baseclass + i;

    var tr = document.querySelectorAll(id);

    var province = tr[0].querySelectorAll("td")[1].innerText;
    
    var provincedata = {
        name : province,
        citys : []
    };

    data.push(provincedata);

    for(var j = 0 ; j < tr.length ; j ++){

        var links = tr[j].querySelectorAll("td")[2].querySelectorAll("a");



        for(var k = 0 ; k < links.length ; k ++){

            var link = links[k];
            var name = link.innerText;
            var href = link.href;
            var sname_reg = /http\:\/\/(.*)\.fang\.com/ig;
            console.log(href);
            provincedata.citys.push({
                name : link.innerText,
                href : link.href,
                sname : sname_reg.exec(href)[1],
            });
        }


    }

}