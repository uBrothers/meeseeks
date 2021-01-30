// Point 생성자 함수를 생성합니다.
function Point(event, target) {
    this.x = Math.round(event.offsetX);
    this.y = Math.round(event.offsetY);
};

function distanceBW(point1, point2) {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}
function angleBW(point1, point2) {
  return Math.atan2( point2.x - point1.x, point2.y - point1.y );
}
function midPointBtw(point1, point2) {
  return {
    x: point1.x + (point2.x - point1.x) / 2,
    y: point1.y + (point2.y - point1.y) / 2
  };
}
//drawi dot
function dLine(ctx,x,y,w,a){
  ctx.beginPath();
  ctx.arc(x,y,w/2,0,a,true);
  ctx.closePath();
  ctx.fill();
}

// Wraping text
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line = '';
  for(var n = 0; n < words.length; n++) {
    if(context.measureText(words[n]).width>maxWidth-6){
      var testword = '';
      for(var m = 0; m < words[n].length; m++) {
        testword += words[n][m];
        if(context.measureText(testword).width>maxWidth-6){
          testword[m]=null;
          var output = [words[n].slice(0, m), ' ', words[n].slice(m)].join('').split(' ');
          words[n] = output[0];
          words.splice(n+1,0,output[1]);
          n++;m=0;testword = words[n][m];
        }
      }
    }
  }
  for(var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var testWidth = context.measureText(testLine).width;
    if(words[n]=="\n"){
      context.fillText(line, x, y);
      line = '';
      y += lineHeight;
    } else if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
  context.restore();
  return y;
};

//chooseAlpha according to value
function chooseAlpha(value,w,p){
  if(p=="pen"){
    alpha=value;
  } else if(p=="brush"){
    alpha=0.3;
    if(w<=5){
      alpha*=2;
      if(w==1){alpha*=4}
    }
  }
  return alpha
}


//create link
function createLink(x,y){
  var numArray = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','l','m','n','o','p','q','r','s','t','u','v','w','x','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  var xStr = '';
  var yStr = '';
  var calX = x;
  var calY = y;
  var minusX = false;
  var minusY = false;
  if(calX<0){minusX = true;calX*=-1}
  if(calY<0){minusY = true;calY*=-1}
  for (i=0;1;i++) {
    xStr = numArray[calX%60]+xStr;
    calX = Math.floor(calX/60);
    if(calX<1){break}
  }
  for (i=0;1;i++) {
    yStr = numArray[calY%60]+yStr;
    calY = Math.floor(calY/60);
    if(calY<1){break}
  }
  if(minusX){xStr+='k'}
  if(minusY){yStr+='k'}
  return xStr+'y'+yStr
}
