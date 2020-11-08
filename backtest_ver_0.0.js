const moment = require('moment');
const Slack = require('slack-node');


apiToken = 'xoxb-1398877919094-1406719016898-vSj7JEDRgOSEeK6MTDOygRng';
const slack = new Slack(apiToken);
const send = async(message) => {
  slack.api('chat.postMessage', {
      text: message,
      channel: 'meeseeks-bot',  // 메시지가 전송될 채널
    }, function(err, response){
      if (err) {
        console.log(err);
      }
    });
}

var mysql = require('sync-mysql');
var db = new mysql({
  host:'localhost',
  user:'root',
  password:'password',
  database:'meeseeks'
});

if(db){
  console.log("Database Connected to 'meeseeks'");
}

// 종가 > 5일선 > 10일선 > 20일선, 종가 > 시가 && vol_5 > vol_10
let day=moment().day(); //0: 일, 1: 월, 2: 화. 3: 수, 4: 목, 5: 금, 6: 토
let buyList=[]; //['A028300', 'A007570'] 이런식으로 데이터 타입이 저장되어야함!!
let companyInfo = db.query('SELECT * FROM company_info');
let date = moment().add(1,'days').format('YYYY-MM-DD'); //내일 거래리스트이기에 내일 날짜
let money=100;
let sum=0;
var margin=4/100;
var period = 2;

for(var n=period; n>0; n--){
  var nday;
  var count=0;
  var percent=0;
  for(var i=0; i<companyInfo.length; i++){
    var params = companyInfo[i].code;
    var sql = 'SELECT * FROM daily_price WHERE code = "' + params + '"ORDER by date DESC';
    let price = db.query(sql);
    let line_5, line_10, line_20;
    let vol_5, vol_10;
    if(price.length>60){ //최소 130일이상 데이터가 있는 주가데이터만 가져옴
      line_5=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close)/5;
      line_10=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close+price[n+5].close+price[n+6].close+price[n+7].close+price[n+8].close+price[n+9].close)/10;
      line_20=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close+price[n+5].close+price[n+6].close+price[n+7].close+price[n+8].close+price[n+9].close+price[n+10].close+price[n+11].close+price[n+12].close+price[n+13].close+price[n+14].close+price[n+15].close+price[n+16].close+price[n+17].close+price[n+18].close+price[n+19].close)/20;
      vol_5=(price[n].volume+price[n+1].volume+price[n+2].volume+price[n+3].volume+price[n+4].volume)/5;
      vol_10=(price[n].volume+price[n+1].volume+price[n+2].volume+price[n+3].volume+price[n+4].volume+price[n+5].volume+price[n+6].volume+price[n+7].volume+price[n+8].volume+price[n+9].volume)/10;
      if(price[n].close>line_5&&line_5>=line_10&&line_10>=line_20){
        if(price[n].close<price[n].open&&vol_5>vol_10){
          if(price[n-1].open){
            if(margin>0){
              if(price[n-1].high>(1+margin)*price[n-1].open){
                count++;
                percent=percent+price[n-1].close/(price[n-1].open*(1+margin))-1;
                buyList.push(companyInfo[i].company);
                nday=price[n-1].date;
              }
            }else{
              if(price[n-1].low<(1+margin)*price[n-1].open){
                count++;
                percent=percent+price[n-1].close/(price[n-1].open*(1+margin))-1;
                buyList.push(companyInfo[i].company);
                nday=price[n-1].date;
              }
            }
          }
        }
      }
    }
  }
  var nDay = moment(nday).format('YYYY-MM-DD');
  console.log(nDay);
  var a=percent/count*100-0.3;
  console.log(count,"****",a.toFixed(3));
  money=money*(1+a/100);
  console.log("money: ",money.toFixed(3));
  sum=sum+a;
  console.log(buyList);
  //console.log("단리 수익",sum);
  //console.log(buyList);
  console.log(" ");
  buyList=[];
}

let condition = '' + "backtest_ver00.js --> margin : " + margin;
let message = '' + period + "일(거래일) 간 누적 수익 : " + (money-100).toFixed(2) +"%";
send('< BACK TEST RESULT >')
send(condition)
send(message);
