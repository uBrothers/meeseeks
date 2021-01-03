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
let index_period=3;
var cci = new Array(5);
var bollinger = new Array(5), bollinger_std = new Array(5), bollinger_up = new Array(5), bollinger_down = new Array(5);
var rsi = new Array(5), num_rsi=100;
var percentB = new Array(5);
var mfi = new Array(5);
var ii = new Array(25);
var percentII = new Array(5);
//스케쥴 관련 자동 실행 아래 부분 all
for(var i=0; i<companyInfo.length; i++){
  var params = companyInfo[i].code;
  var sql = 'SELECT * FROM daily_price WHERE code = "' + params + '"ORDER by date DESC';
  let price = db.query(sql);
  let line_5, line_10, line_20;
  let vol_5, vol_10;
  if(price.length>num_rsi+index_period){ //최소 130일이상 데이터가 있는 주가데이터만 가져옴
    line_5=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close)/5;
    line_10=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close)/10;
    line_20=(price[0].close+price[1].close+price[2].close+price[3].close+price[4].close+price[5].close+price[6].close+price[7].close+price[8].close+price[9].close+price[10].close+price[11].close+price[12].close+price[13].close+price[14].close+price[15].close+price[16].close+price[17].close+price[18].close+price[19].close)/20;
    vol_5=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume)/5;
    vol_10=(price[0].volume+price[1].volume+price[2].volume+price[3].volume+price[4].volume+price[5].volume+price[6].volume+price[7].volume+price[8].volume+price[9].volume)/10;

    //cci & bollinger & rsi logic & %b & mfi
    for(var k=0; k<index_period; k++){
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
            for (var w = num_rsi-1+k; w > k; w--) {
              if(w>num_rsi-14+k){
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
            percentB[k]=(price[k].close-bollinger_down[k])/(bollinger_std[k]*4); //%b 0.8보다 크면 매수 신호; 0.2보다 작으면 매도 신호;
            //MFI money flow index 10일간
            var pmf=0, nmf=0;
            for(var p=k; p<10+k; p++){
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
              if(price[q+k].high-price[q+k].low>0 && checkII==0){
                ii[q]=price[q+k].volume*(2*price[q+k].close-price[q+k].high-price[q+k].low)/(price[q+k].high-price[q+k].low);
                vol_21+=price[q+k].volume;
                percentII[k]+=ii[q];
              }else{
                vol_21=1;
                percentII[k]=0;
                checkII=1;
              }
            }
            percentII[k]=100*percentII[k]/vol_21;
    }

    if(mfi[0]<20 && mfi[0]>0){
      if(percentB[0]<0.2)
      console.log(companyInfo[i].company,percentII[0],percentII[1],percentII[2]);
    }
    //main logic
  }
}
