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


schedule.scheduleJob('45 18 * * *', function(){
  // 종가 > 5일선 > 10일선 > 20일선, 종가 > 시가 && vol_5 > vol_10
  let day=moment().day(); //0: 일, 1: 월, 2: 화. 3: 수, 4: 목, 5: 금, 6: 토
  let buyList=[]; //['A028300', 'A007570'] 이런식으로 데이터 타입이 저장되어야함!!
  let list=[];
  let companyInfo = db.query('SELECT * FROM company_info');
  let date = moment().add(1,'days').format('YYYY-MM-DD'); //내일 거래리스트이기에 내일 날짜
  let money=100;
  let sum=0;
  var margin=-5/100;
  var period = 2; //backtest days
  var cbr_period=3;
  var cci = new Array(5);
  var bollinger = new Array(5), bollinger_std = new Array(5), bollinger_up = new Array(5), bollinger_down = new Array(5);
  var rsi = new Array(5), num_rsi=100;

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
      if(price.length>num_rsi+cbr_period+n){ //최소 130일이상 데이터가 있는 주가데이터만 가져옴
        line_5=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close)/5;
        line_10=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close+price[n+5].close+price[n+6].close+price[n+7].close+price[n+8].close+price[n+9].close)/10;
        line_20=(price[n].close+price[n+1].close+price[n+2].close+price[n+3].close+price[n+4].close+price[n+5].close+price[n+6].close+price[n+7].close+price[n+8].close+price[n+9].close+price[n+10].close+price[n+11].close+price[n+12].close+price[n+13].close+price[n+14].close+price[n+15].close+price[n+16].close+price[n+17].close+price[n+18].close+price[n+19].close)/20;
        vol_5=(price[n].volume+price[n+1].volume+price[n+2].volume+price[n+3].volume+price[n+4].volume)/5;
        vol_10=(price[n].volume+price[n+1].volume+price[n+2].volume+price[n+3].volume+price[n+4].volume+price[n+5].volume+price[n+6].volume+price[n+7].volume+price[n+8].volume+price[n+9].volume)/10;

        //cci & bollinger & rsi logic
        for(var k=0; k<cbr_period; k++){
                //cci
                var m=0, x14=0;
                for(var j = k+n; j < k+n+14; j++){
                  price[j].M = (price[j].close+price[j].high+price[j].low)/3;
                  m += price[j].M;
                }
                m = m/14;
                for(var r = k+n; r < k+n+14; r++){
                  if(price[r].M<m){
                    price[r].d = m-price[r].M;
                  }else{
                   price[r].d = price[r].M-m;
                  }
                  x14 += price[r].d;
                }
                x14 = x14/14;
                cci[k] = (price[k+n].M-m)/(x14*0.015);
                //bollinger
                bollinger_std[k]=math.std([price[n+k].close,price[n+k+1].close,price[n+k+2].close,price[n+k+3].close,price[n+k+4].close,price[n+k+5].close,price[n+k+6].close,price[n+k+7].close,price[n+k+8].close,price[n+k+9].close,price[n+k+10].close,price[n+k+11].close,price[n+k+12].close,price[n+k+13].close,price[n+k+14].close,price[n+k+15].close,price[n+k+16].close,price[n+k+17].close,price[n+k+18].close,price[n+k+19].close],'uncorrected');
                bollinger[k]=math.mean([price[n+k].close,price[n+k+1].close,price[n+k+2].close,price[n+k+3].close,price[n+k+4].close,price[n+k+5].close,price[n+k+6].close,price[n+k+7].close,price[n+k+8].close,price[n+k+9].close,price[n+k+10].close,price[n+k+11].close,price[n+k+12].close,price[n+k+13].close,price[n+k+14].close,price[n+k+15].close,price[n+k+16].close,price[n+k+17].close,price[n+k+18].close,price[n+k+19].close]);
                bollinger_up[k]=bollinger[k]+2*bollinger_std[k];
                bollinger_down[k]=bollinger[k]-2*bollinger_std[k];
                //rsi
                var rsi_up=0, rsi_down=0;
                for (var w = num_rsi+n-1; w > n; w--) {
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

        if(companyInfo[i].code=='028300'){
          console.log(cci[0],cci[1],cci[2]);
          console.log(bollinger[0],bollinger[1],bollinger[2]);
          console.log(rsi[0],rsi[1],rsi[2]);
        }


        if(rsi[0]<38 && cci[1]<-100 && cci[2]<-100){
          if(cci[0]>cci[1] && cci[0]>-105){
            if(price[1].high<bollinger[1] && price[0].high<bollinger[0]){

              if(price[n].close>line_5&&line_5>=line_10&&line_10>=line_20){
                if(price[n].close<price[n].open&&vol_5>vol_10){
                  if(price[n-1].open){
                    if(margin>=0){
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
        }

  /* else if (rsi0>58 && cci0>95) {
          if(cci1>cci2 && cci1>80){
            if(max>1000 && parseInt(data[1].low_price)>bollinger1 && parseInt(data[0].low_price)>bollinger0){
              upbit.order_bid('KRW-BTC',max);
              trade.save.insert({coin:"KRW-BTC", option:"maker", position:"추격매수", price:parseInt(data[0].trade_price)+1000, amount:max, time:time, utc:utc});
            }
          }
        }*/

  /*
        //main logic
        if(price[n].close>line_5&&line_5>=line_10&&line_10>=line_20){
          if(price[n].close<price[n].open&&vol_5>vol_10){

            if(price[n-1].open){
              if(margin>=0){
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
  */
      }
    }
    if(count){
      var nDay = moment(nday).format('YYYY-MM-DD');
      console.log(nDay);
      var a=percent/count*100-0.3;
      console.log(count,"****",a.toFixed(3));
      money=money*(1+a/100);
      console.log("money: ",money.toFixed(3));
      sum=sum+a;
      //console.log("단리 수익",sum);
      //console.log(buyList);
      console.log(" ");
    }else{
      var nDay = moment(nday).format('YYYY-MM-DD');
      console.log(nDay);
      console.log("거래 안함");
    }
  }

  let condition = '' + "backtest_ver00.js --> margin : " + margin;
  let message = '' + period + "일(거래일) 간 누적 수익 : " + (money-100).toFixed(2) +"%";
  send('< BACK TEST RESULT >')
  send(condition)
  send(message);

});
