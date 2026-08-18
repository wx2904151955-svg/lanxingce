var val="气的抢我的手柄 还砸到我的手 无动于衷 https://xhslink.cn/o/5VoZ6GlK6op 来【小红书】一探究竟吧！";
var re=/https?:\/\/[^\s，。、；：！？）】」'"”’]+|www\.[a-z0-9-]+(\.[a-z0-9-]+)+[^\s，。、；：！？）】」'"”’]*/i;
var m=val.match(re);
if(!m){console.log("未匹配");process.exit(0);}
var raw=m[0];
var clean=raw.replace(/[.,;:!?)\]}'"]+$/,'');
if(/^www\./i.test(clean))clean='https://'+clean;
console.log("匹配到:",raw);
console.log("清理后:",clean);
var rest=val.replace(raw,"").replace(/\s{2,}/g," ").trim();
console.log("主框剩余:",rest);
