const moment = require('moment');
const Slack = require('slack-node');
const schedule = require('node-schedule');
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


schedule.scheduleJob('15 18 * * *', function(){
  // 종가 > 5일선 > 10일선 > 20일선, 종가 > 시가 && vol_5 > vol_10
  let buyList=[]; //['A028300', 'A007570'] 이런식으로 데이터 타입이 저장되어야함!!
  let list=[];
  let companyInfo = db.query('SELECT * FROM company_info');
  var cbr_period=3; //cci & bollinger & rsi logic
  var cci = new Array(5);
  var bollinger = new Array(5), bollinger_std = new Array(5), bollinger_up = new Array(5), bollinger_down = new Array(5);
  var rsi = new Array(5), num_rsi=100;
  var count=0;
  var percent=0;
  for(var i=0; i<companyInfo.length; i++){
    var params = companyInfo[i].code;
    var sql = 'SELECT * FROM daily_price WHERE code = "' + params + '"ORDER by date DESC';
    let price = db.query(sql);
    let line_5, line_10, line_20;
    let vol_5, vol_10;
    if(price.length>num_rsi+cbr_period){ //최소 100+cbr_period일 초과 데이터가 있는 주가데이터만 가져옴
      line_5=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close)/5;
      line_10=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close)/10;
      line_20=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close+price[10].close+price[11].close+price[12].close+price[13].close+price[14].close+price[15].close+price[16].close+price[17].close+price[18].close+price[19].close)/20;
      vol_5=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume)/5;
      vol_10=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume+price[5].volume+price[6].volume+price[7].volume+price[8].volume+price[9].volume)/10;

      //cci & bollinger & rsi logic
      for(var k=0; k<cbr_period; k++){
              //cci
              var m=0, x14=0;
              for(var j = k; j < k+14; j++){
                price[j].M = (price[j].close+price[j].high+price[j].low)/3;
                m += price[j].M;
              }
              m = m/14;
              for(var r = k; r < k+14; r++){
                if(price[r].M<m){
                  price[r].d = m-price[r].M;
                }else{
                 price[r].d = price[r].M-m;
                }
                x14 += price[r].d;
              }
              x14 = x14/14;
              cci[k] = (price[k].M-m)/(x14*0.015);
              //bollinger
              bollinger_std[k]=math.std([price[k].close,price[k+1].close,price[k+2].close,price[k+3].close,price[k+4].close,price[k+5].close,price[k+6].close,price[k+7].close,price[k+8].close,price[k+9].close,price[k+10].close,price[k+11].close,price[k+12].close,price[k+13].close,price[k+14].close,price[k+15].close,price[k+16].close,price[k+17].close,price[k+18].close,price[k+19].close],'uncorrected');
              bollinger[k]=math.mean([price[k].close,price[k+1].close,price[k+2].close,price[k+3].close,price[k+4].close,price[k+5].close,price[k+6].close,price[k+7].close,price[k+8].close,price[k+9].close,price[k+10].close,price[k+11].close,price[k+12].close,price[k+13].close,price[k+14].close,price[k+15].close,price[k+16].close,price[k+17].close,price[k+18].close,price[k+19].close]);
              bollinger_up[k]=bollinger[k]+2*bollinger_std[k];
              bollinger_down[k]=bollinger[k]-2*bollinger_std[k];
              //rsi
              var rsi_up=0, rsi_down=0;
              for (var w = num_rsi-1; w > n; w--) {
                if(w>num_rsi-14){
                  if(price[w+k-1].close-price[w+k].close>0){
                    rsi_up+=(price[w+k-1].close-price[w+k].close)/14;
                  }else{
                    rsi_down-=(price[w+k-1].close-price[w+k].close)/14;
                  }
                }else {
                  if(price[w+k-1].close-price[w+k].close>0){
                    rsi_up=(rsi_up*13+(price[w+k-1].close-price[w+k].close))/14;
                    rsi_down=rsi_down*13/14;
                  }else{
                    rsi_down=(rsi_down*13-(price[w+k-1].close-price[w+k].close))/14;
                    rsi_up=rsi_up*13/14;
                  }
                }
              }
              rsi[k]=rsi_up*100/(rsi_up+rsi_down);
      }

      //에이치엘비 종목에 대한 cci, bollinger, rsi 확인용
      if(companyInfo[i].code=='028300'){
        console.log(cci[0],cci[1],cci[2]);
        console.log(bollinger[0],bollinger[1],bollinger[2]);
        console.log(rsi[0],rsi[1],rsi[2]);
      }

      //main logic
      if(price[0].close>line_5&&line_5>=line_10&&line_10>=line_20){
        if(price[0].close<price[0].open&&vol_5>vol_10){

          if(rsi[0]>58 && cci[1]<-100 && cci[2]<-100){
            if(cci[0]>cci[1] && cci[0]>-105){
              if(price[1].high<bollinger[1] && price[0].high<bollinger[0]){

                if(price[0].close>line_5&&line_5>=line_10&&line_10>=line_20){
                  if(price[0].close<price[0].open&&vol_5>vol_10){
                    count++;
                    buyList.push(companyInfo[i].company);

                  }
                }

              }
            }
          }

        }
      }
    }
  }

  let tomorrow = moment().add(1,'days').format('YYYY-MM-DD'); //내일 거래리스트이기에 내일 날짜
  let day_num=moment().day(); //0: 일, 1: 월, 2: 화. 3: 수, 4: 목, 5: 금, 6: 토
  if(day_num==5||day_num==6){
    send('내일은 주말입니다.');
  }else{
    if(count){
      //mysql에 buyList 추가하기
      send(buyList);
    }else{
      //mysql에 buyList 추가하기
      console.log("다음날 살 종목이 없음 -> 거래 안함");
    }
  }

});
