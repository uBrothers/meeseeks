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

// 종가 > 5일선 > 10일선 > 20일선, 종가 > 시가 && vol_5 > vol_10
let companyInfo = db.query('SELECT * FROM company_info');
let buyList=[]; //['A028300', 'A007570'] 이런식으로 데이터 타입이 저장되어야함!!
let money=100;
var margin=5/100;
var period = 1; //backtest days
var cbr_period=3;
var cci = new Array(5);
var bollinger = new Array(5), bollinger_std = new Array(5), bollinger_up = new Array(5), bollinger_down = new Array(5);
var rsi = new Array(5), num_rsi=100;
var percentB = new Array(5);
var mfi = new Array(5);
var ii = new Array(25);
var percentII = new Array(5);
for(var n=period; n>0; n--){
  var date;
  var percent=0;
  var count=0, real_buy_count=0, buy_count=0, vol_count=0, rsi_count=0, cci_count=0, bollinger_count=0, golden_cross_count=0;
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

      //cci & bollinger & rsi logic & %b & mfi
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
              for (var w = num_rsi-1+n+k; w > n+k; w--) {
                if(w>num_rsi-14+n+k){
                  if(price[w-1].close-price[w].close>0){
                    rsi_up+=(price[w-1].close-price[w].close)/14;
                  }else{
                    rsi_down-=(price[w-1].close-price[w].close)/14;
                  }
                }else {
                  if(price[w-1].close-price[w].close>0){
                    rsi_up=(rsi_up*13+(price[w-1].close-price[w].close))/14;
                    rsi_down=rsi_down*13/14;
                  }else{
                    rsi_down=(rsi_down*13-(price[w-1].close-price[w].close))/14;
                    rsi_up=rsi_up*13/14;
                  }
                }
              }
              rsi[k]=rsi_up*100/(rsi_up+rsi_down);

              //percentB
              percentB[k]=(price[n+k].close-bollinger_down[k])/(bollinger_std[k]*4); //%b 0.8보다 크면 매수 신호; 0.2보다 작으면 매도 신호;
              //MFI money flow index 10일간
              var pmf=0, nmf=0;
              for(var p=n+k; p<10+n+k; p++){
                if(price[p].M>price[p+1].M){//긍정적 흐름
                  pmf+=price[p].M*price[p].volume;
                }else{//부정적 흐름
                  nmf+=price[p].M*price[p].volume;
                }
              }
              if(nmf==0){
                nmf=0.001;
              }
              mfi[k] = 100-100/(1+pmf/nmf); //mfi가 80보다 크면 매수 신호; mfi가 20보다 작으면 매도 신호;

              //일중 강도
              var vol_21=0, checkII=0;
              percentII[k]=0;
              for(var q=0; q<21; q++){
                if(price[q+k+n].high-price[q+k+n].low>0 && checkII==0){
                  ii[q]=price[q+k+n].volume*(2*price[q+k+n].close-price[q+k+n].high-price[q+k+n].low)/(price[q+k+n].high-price[q+k+n].low);
                  vol_21+=price[q+k+n].volume;
                  percentII[k]+=ii[q];
                }else{
                  vol_21=1;
                  percentII[k]=0;
                  checkII=1;
                }
              }
              percentII[k]=100*percentII[k]/vol_21;
      }
      //test 지표
      if(params=="005930"){
        console.log("RSI: ", rsi[0],rsi[1],rsi[2]);
        console.log("CCI: ", cci[0],cci[1],cci[2]);
        console.log("MFI: ", mfi[0],mfi[1],mfi[2]);
        console.log("%B: ", percentB[0],percentB[1],percentB[2]);
        console.log("%II: ", percentII[0],percentII[1],percentII[2]);
        console.log("Bol_down: ", bollinger_down[0],bollinger_down[1],bollinger_down[2]);

      }

      //main logic
      if(vol_5>=vol_10){
        if(line_5>=line_10 && line_10>=line_20){
          if(margin>=0){
            if(price[n-1].high>(1+margin)*price[n-1].open){
              count++;
              percent=percent+price[n-1].close/(price[n-1].open*(1+margin))-1;
              buyList.push(companyInfo[i].company);
              date=price[n-1].date;
            }
          }
        }
      }

    }
  }

  if(count){
    var testDate = moment(date).format('YYYY-MM-DD');
    console.log(testDate);
    var fee=percent/count*100-0.3;
    console.log(count,"종목 ",fee.toFixed(3));
    money=money*(1+fee/100);
    console.log("money: ",money.toFixed(3));
    //console.log(buyList);
    console.log(" ");
    buyList=[];

  }else{
    var testDate = moment(date).format('YYYY-MM-DD');
    console.log(testDate);
    console.log("거래 안함");
  }

}
let message = '' + period + " 거래일 back test 예상 누적 수익 : " + (money-100).toFixed(2) +"%";
console.log(message);
//send(message);
