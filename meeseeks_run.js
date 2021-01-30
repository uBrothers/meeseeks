const moment = require('moment');
const Slack = require('slack-node');
const math = require('mathjs');

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

var day=moment().day(); //0: 일, 1: 월, 2: 화. 3: 수, 4: 목, 5: 금, 6: 토
let buyList=[]; //['A028300', 'A007570'] 이런식으로 데이터 타입이 저장되어야함!!
let list=[];
let companyInfo = db.query('SELECT * FROM company_info');
var date = moment().add(1,'days').format('YYYY-MM-DD'); //내일 거래리스트이기에 내일 날짜
var c=0;

for(var i=0; i<companyInfo.length; i++){
  var params = companyInfo[i].code;
  var sql = 'SELECT * FROM daily_price WHERE code = "' + params + '"ORDER by date DESC';
  let price = db.query(sql);
  let line_5, line_10, line_20;
  if(price.length>30){ //최소 한달이상 데이터가 있는 주가데이터만 가져옴
    line_5=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close)/5;
    line_10=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close)/10;
    line_20=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close+price[10].close+price[11].close+price[12].close+price[13].close+price[14].close+price[15].close+price[16].close+price[17].close+price[18].close+price[19].close)/20;
    vol_5=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume)/5;
    vol_10=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume+price[5].volume+price[6].volume+price[7].volume+price[8].volume+price[9].volume)/10;
    if(price[0].close>line_5&&line_5>=line_10&&line_10>=line_20){
      if(price[0].close<price[0].open&&vol_5>vol_10){
        if(price[0].open){
          c++;
          list.push(c+':'+companyInfo[i].company);
          buyList.push('A'+companyInfo[i].code);
        }
      }
    }
  }
}

var buySQL = 'INSERT INTO buy_list (list, date) VALUES ("'+buyList+'","'+date+'") ON DUPLICATE KEY UPDATE list="'+buyList+'", date="'+date+'"';
db.query(buySQL);

send("[meeseeks_run.js] `매수 종목 검색 및 저장 완료`");
