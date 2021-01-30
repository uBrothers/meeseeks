import os, sys, ctypes
import win32com.client
import pandas as pd
from datetime import datetime, timedelta
from slacker import Slacker
import time, calendar
from bs4 import BeautifulSoup
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import pymysql
import logging

logname = datetime.now().strftime("%Y-%m-%d")
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
file_handler = logging.FileHandler("../logs/"+logname+".log", encoding='utf-8')
logger.addHandler(file_handler)

class MarketDB:
    def __init__(self):
        self.conn = pymysql.connect(host='localhost',user='root',password='password',db='meeseeks',charset='utf8')
        self.codes = {}
        self.get_buy_list()

        with self.conn.cursor() as curs:
            sql = """
            CREATE TABLE IF NOT EXISTS trade_log (
                date Date,
                start_money BIGINT(20),
                start_stock VARCHAR(20),
                start_total BIGINT(20),
                end_money BIGINT(20),
                end_stock BIGINT(20),
                bought_stock VARCHAR(20),
                keep_stock VARCHAR(20),
                end_total BIGINT(20),
                profit BIGINT(20),
                deposit_withdrawal VARCHAR(20),
                PRIMARY KEY (date))
            """
            curs.execute(sql)

    def trade_log_start():
        with self.conn.cursor() as curs:
            today = datetime.now().strftime('%Y-%m-%d')
            start_money = int(get_current_cash())
            start_stock = get_current_stock()
            start_total = int(get_current_total())
            deposit_withdrawal = 0
            sql = f"INSERT INTO trade_log (date, start_money, start_stock, start_total, deposit_withdrawal)"\
            f" VALUES ('{today}', '{start_money}', '{start_stock}', '{start_total}', '{deposit_withdrawal}')"\
            f" ON DUPLICATE KEY UPDATE date='{today}'"
            curs.execute(sql)
            self.conn.commit()
        return True

    def trade_log_middle():
        with self.conn.cursor() as curs:
            today = datetime.now().strftime('%Y-%m-%d')
            bought_stock = get_current_stock()
            sql = f"INSERT INTO trade_log (date, bought_stock) VALUES ('{today}', '{bought_stock}')"\
            f" ON DUPLICATE KEY UPDATE date='{today}'"
            curs.execute(sql)
            self.conn.commit()
        return True

    def trade_log_keep(keep):
        global keep_list
        str_today = datetime.now().strftime('%Y%m%d')
        stocks = get_current_stock()
        for s in stocks:
            ohlc = get_ohlc(s['code'], 5)
            if str_today == str(ohlc.iloc[0].name):
                today_open = ohlc.iloc[0].open
                lastday = ohlc.iloc[1]
            else:
                lastday = ohlc.iloc[0]
                today_open = lastday[3]
            current_price, ask_price, bid_price = get_current_price(s['code'])
            if current_price > today_open*1.1:
                keep_list.append(s['code'])
        with self.conn.cursor() as curs:
            today = datetime.now().strftime('%Y-%m-%d')
            keep_stock = keep_list
            sql = f"INSERT INTO trade_log (date, keep_stock) VALUES ('{today}', '{keep_stock}')"\
            f" ON DUPLICATE KEY UPDATE date='{today}'"
            curs.execute(sql)
            self.conn.commit()
        return True

    def trade_log_end(initialTotal):
        with self.conn.cursor() as curs:
            today = datetime.now().strftime('%Y-%m-%d')
            end_money = int(get_current_cash())
            end_stock = get_current_stock()
            end_total = int(get_current_total())
            if end_total == 0 :
                profit = 0
            elif initialTotal == 0 :
                profit = 0
            else :
                profit = (end_total-initialTotal)*100/end_total
            sql = f"INSERT INTO trade_log (date, end_money, end_stock, end_total, profit)"\
            f" VALUES ('{today}', '{end_money}', '{end_stock}', '{end_total}', '{profit}')"\
            f" ON DUPLICATE KEY UPDATE date='{today}'"
            curs.execute(sql)
            self.conn.commit()
        return True

    def __del__(self):
        self.conn.close()

    def get_buy_list(self):
        dayCheck = datetime.today().strftime('%Y-%m-%d')
        sql = f"SELECT * FROM buy_list WHERE date = '{dayCheck}'"
        buyList = pd.read_sql(sql, self.conn)
        return buyList    #['A028300', 'A007570']

    def yesterday_keep_list(self):
        yesterday = datetime.today()-timedelta(days=1)
        dayCheck = yesterday.strftime('%Y-%m-%d')
        sql = f"SELECT * FROM trade_log WHERE date = '{dayCheck}'"
        keepList = pd.read_sql(sql, self.conn)
        return keepList    #['A028300', 'A007570']

slack = Slacker('xoxb-1398877919094-1406719016898-vSj7JEDRgOSEeK6MTDOygRng')
def dbgout(message):
    """인자로 받은 문자열을 파이썬 셸과 슬랙으로 동시에 출력한다."""
    print(datetime.now().strftime('[%m/%d %H:%M:%S]'), message)
    strbuf = datetime.now().strftime('[%m/%d %H:%M:%S] ') + message
    slack.chat.post_message('#meeseeks-bot', strbuf)
    logger.info(strbuf)

def printlog(message, *args):
    """인자로 받은 문자열을 파이썬 셸에 출력한다."""
    print(datetime.now().strftime('[%m/%d %H:%M:%S]'), message, *args)
    msg = datetime.now().strftime('[%m/%d %H:%M:%S] ') + message + str(*args)
    logger.info(msg)

# 크레온 플러스 공통 OBJECT
cpCodeMgr = win32com.client.Dispatch('CpUtil.CpStockCode')
cpStatus = win32com.client.Dispatch('CpUtil.CpCybos')
cpTradeUtil = win32com.client.Dispatch('CpTrade.CpTdUtil')
cpStock = win32com.client.Dispatch('DsCbo1.StockMst')
cpOhlc = win32com.client.Dispatch('CpSysDib.StockChart')
cpBalance = win32com.client.Dispatch('CpTrade.CpTd6033')
cpCash = win32com.client.Dispatch('CpTrade.CpTdNew5331A')
cpOrder = win32com.client.Dispatch('CpTrade.CpTd0311')

def check_creon_system():
    """크레온 플러스 시스템 연결 상태를 점검한다."""
    # 관리자 권한으로 프로세스 실행 여부
    if not ctypes.windll.shell32.IsUserAnAdmin():
        printlog('check_creon_system() : admin user -> FAILED')
        return False

    # 연결 여부 체크
    if (cpStatus.IsConnect == 0):
        printlog('check_creon_system() : connect to server -> FAILED 연결 실패')
        return False

    # 주문 관련 초기화 - 계좌 관련 코드가 있을 때만 사용
    if (cpTradeUtil.TradeInit(0) != 0):
        printlog('check_creon_system() : init trade -> FAILED 주문 초기화 실패')
        return False
    return True

def get_current_price(code):
    """인자로 받은 종목의 현재가, 매수호가, 매도호가를 반환한다."""
    cpStock.SetInputValue(0, code)  # 종목코드에 대한 가격 정보
    cpStock.BlockRequest()
    item = {}
    item['cur_price'] = cpStock.GetHeaderValue(11)   # 현재가
    item['ask'] =  cpStock.GetHeaderValue(16)        # 매수호가
    item['bid'] =  cpStock.GetHeaderValue(17)        # 매도호가
    return item['cur_price'], item['ask'], item['bid']

def get_ohlc(code, qty):
    """인자로 받은 종목의 OHLC 가격 정보를 qty 개수만큼 반환한다."""
    cpOhlc.SetInputValue(0, code)           # 종목코드
    cpOhlc.SetInputValue(1, ord('2'))        # 1:기간, 2:개수
    cpOhlc.SetInputValue(4, qty)             # 요청개수
    cpOhlc.SetInputValue(5, [0, 2, 3, 4, 5]) # 0:날짜, 2~5:OHLC
    cpOhlc.SetInputValue(6, ord('D'))        # D:일단위
    cpOhlc.SetInputValue(9, ord('1'))        # 0:무수정주가, 1:수정주가
    cpOhlc.BlockRequest()
    count = cpOhlc.GetHeaderValue(3)   # 3:수신개수
    columns = ['open', 'high', 'low', 'close']
    index = []
    rows = []
    for i in range(count):
        index.append(cpOhlc.GetDataValue(0, i))
        rows.append([cpOhlc.GetDataValue(1, i), cpOhlc.GetDataValue(2, i),
            cpOhlc.GetDataValue(3, i), cpOhlc.GetDataValue(4, i)])
    df = pd.DataFrame(rows, columns=columns, index=index)
    return df

def get_stock_balance(code):
    """인자로 받은 종목의 종목명과 수량을 반환한다."""
    global keep_list
    cpTradeUtil.TradeInit()
    acc = cpTradeUtil.AccountNumber[0]      # 계좌번호
    accFlag = cpTradeUtil.GoodsList(acc, 1) # -1:전체, 1:주식, 2:선물/옵션
    cpBalance.SetInputValue(0, acc)         # 계좌번호
    cpBalance.SetInputValue(1, accFlag[0])  # 상품구분 - 주식 상품 중 첫번째
    cpBalance.SetInputValue(2, 50)          # 요청 건수(최대 50)
    cpBalance.BlockRequest()
    if code == 'ALL':
        dbgout('계좌명 : ' + str(cpBalance.GetHeaderValue(0)))
        dbgout('예수금 : ' + str(cpBalance.GetHeaderValue(9)))
        dbgout('결제잔고수량 : ' + str(cpBalance.GetHeaderValue(1)))
        dbgout('평가금액 : ' + str(cpBalance.GetHeaderValue(3)))
        dbgout('평가손익 : ' + str(cpBalance.GetHeaderValue(4)))
        dbgout('종목수 : ' + str(cpBalance.GetHeaderValue(7)))
    stocks = []
    for i in range(cpBalance.GetHeaderValue(7)):
        stock_code = cpBalance.GetDataValue(12, i)  # 종목코드
        stock_name = cpBalance.GetDataValue(0, i)   # 종목명
        stock_qty = cpBalance.GetDataValue(15, i)   # 수량
        if code == 'ALL':
            dbgout(str(i+1) + ' ' + stock_code + '(' + stock_name + ')'
                + ':' + str(stock_qty))
            stocks.append({'code': stock_code, 'name': stock_name,
                'qty': stock_qty})
        elif code == 'Sell':
            sellCheck=True
            for k in keep_list:
                if stock_code == k:
                    sellCheck = False
            if sellCheck == True:
                stocks.append({'code': stock_code, 'name': stock_name,
                    'qty': stock_qty})
        if stock_code == code:
            return stock_name, stock_qty
    if code == 'ALL':
        return stocks
    elif code == 'Sell':
        return stocks
    else:
        stock_name = cpCodeMgr.CodeToName(code)
        return stock_name, 0

def get_current_cash():
    cpTradeUtil.TradeInit()
    acc = cpTradeUtil.AccountNumber[0]    # 계좌번호
    accFlag = cpTradeUtil.GoodsList(acc, 1) # -1:전체, 1:주식, 2:선물/옵션
    cpCash.SetInputValue(0, acc)              # 계좌번호
    cpCash.SetInputValue(1, accFlag[0])      # 상품구분 - 주식 상품 중 첫번째
    cpCash.BlockRequest()
    return cpCash.GetHeaderValue(9) # 증거금 100% 주문 가능 금액

def get_current_total():
    cpTradeUtil.TradeInit()
    acc = cpTradeUtil.AccountNumber[0]    # 계좌번호
    accFlag = cpTradeUtil.GoodsList(acc, 1) # -1:전체, 1:주식, 2:선물/옵션
    cpCash.SetInputValue(0, acc)              # 계좌번호
    cpCash.SetInputValue(1, accFlag[0])      # 상품구분 - 주식 상품 중 첫번째
    cpCash.BlockRequest()
    total = int(cpCash.GetHeaderValue(9)) + int(cpBalance.GetHeaderValue(3))
    return total # 증거금 100% 주문 가능 금액

def get_current_stock():
    cpTradeUtil.TradeInit()
    acc = cpTradeUtil.AccountNumber[0]    # 계좌번호
    accFlag = cpTradeUtil.GoodsList(acc, 1) # -1:전체, 1:주식, 2:선물/옵션
    cpCash.SetInputValue(0, acc)              # 계좌번호
    cpCash.SetInputValue(1, accFlag[0])      # 상품구분 - 주식 상품 중 첫번째
    cpCash.BlockRequest()
    stocks = []
    for i in range(cpBalance.GetHeaderValue(7)):
        stock_code = cpBalance.GetDataValue(12, i)  # 종목코드
        stock_name = cpBalance.GetDataValue(0, i)   # 종목명
        stock_qty = cpBalance.GetDataValue(15, i)   # 수량
        stocks.append({'code': stock_code, 'name': stock_name, 'qty': stock_qty})
    return stocks # 증거금 100% 주문 가능 금액

def get_target_price(code):
    """매수 목표가를 반환한다."""
    try:
        time_now = datetime.now()
        str_today = time_now.strftime('%Y%m%d')
        ohlc = get_ohlc(code, 10)
        if str_today == str(ohlc.iloc[0].name):
            today_open = ohlc.iloc[0].open
            lastday = ohlc.iloc[1]
        else:
            lastday = ohlc.iloc[0]
            today_open = lastday[3]
        lastday_high = lastday[1]
        lastday_low = lastday[2]
        target_price = today_open * 1.01
        return target_price
    except Exception as ex:
        dbgout("`get_target_price() -> exception! " + str(ex) + "`")
        return None

def get_movingaverage(code, window):
    """인자로 받은 종목에 대한 이동평균가격을 반환한다."""
    try:
        time_now = datetime.now()
        str_today = time_now.strftime('%Y%m%d')
        ohlc = get_ohlc(code, 20)
        if str_today == str(ohlc.iloc[0].name):
            lastday = ohlc.iloc[1].name
        else:
            lastday = ohlc.iloc[0].name
        closes = ohlc['close'].sort_index()
        ma = closes.rolling(window=window).mean()
        return ma.loc[lastday]
    except Exception as ex:
        dbgout('get_movingavrg(' + str(window) + ') -> exception! ' + str(ex))
        return None

def buy_stock(code):
    """인자로 받은 종목을 매수한다."""
    try:
        global bought_list      # 함수 내에서 값 변경을 하기 위해 global로 지정
        if code in bought_list: # 매수 완료 종목이면 더 이상 안 사도록 함수 종료
            printlog('이미 매수한 종목입니다.')
            return False
        else:
            time_now = datetime.now()
            current_price, ask_price, bid_price = get_current_price(code)
            target_price = get_target_price(code)    # 매수 목표가
            ma5_price = get_movingaverage(code, 5)   # 5일 이동평균가
            ma10_price = get_movingaverage(code, 10) # 10일 이동평균가
            buy_qty = 0        # 매수할 수량 초기화
            if ask_price > 0:  # 매수호가가 존재하면
                buy_qty = buy_amount // ask_price
                if buy_qty < 1:
                    return False
            else:
                return False
            stock_name, stock_qty = get_stock_balance(code)  # 종목명과 보유수량 조회
            #printlog('bought_list:', bought_list, 'len(bought_list):',
            #    len(bought_list), 'target_buy_count:', target_buy_count)
            if current_price > target_price:
                printlog('`' + str(stock_name) + '(' + str(code) + ') ' + str(buy_qty) +
                    'EA : ' + str(current_price) + '￦ meets the buy condition!`')
                cpTradeUtil.TradeInit()
                acc = cpTradeUtil.AccountNumber[0]      # 계좌번호
                accFlag = cpTradeUtil.GoodsList(acc, 1) # -1:전체,1:주식,2:선물/옵션
                # 매수 주문 설정
                cpOrder.SetInputValue(0, "2")        # 2: 매수
                cpOrder.SetInputValue(1, acc)        # 계좌번호
                cpOrder.SetInputValue(2, accFlag[0]) # 상품구분 - 주식 상품 중 첫번째
                cpOrder.SetInputValue(3, code)       # 종목코드
                cpOrder.SetInputValue(4, buy_qty)    # 매수할 수량
                #cpOrder.SetInputValue(5, current_price)  # 주문단가
                cpOrder.SetInputValue(7, "2")        # 주문조건 0:기본, 1:IOC, 2:FOK
                cpOrder.SetInputValue(8, "12")       # 주문호가 1:보통, 3:시장가 5:조건부, 12:최유리, 13:최우선
                ret = cpOrder.BlockRequest()
                rqStatus = cpOrder.GetDibStatus()
                orderMsg = cpOrder.GetDibMsg1()
                if rqStatus == 0:
                    if ret == 4:
                        remain_time = cpStatus.LimitRequestRemainTime
                        printlog('주의: 연속 주문 제한에 걸림. 대기 시간 : ', remain_time/1000)
                        time.sleep(remain_time/1000)
                        return False
                    else:
                        bought_list.append(code)
                        dbgout("`매수 완료 : "+ str(stock_name) + ", 수량 : " + str(buy_qty) + "`")
                        time.sleep(2)
                        return True
                else:
                    printlog("매수 실패 : ", orderMsg)
                    time.sleep(2)
                    return False
            else:
                return False
    except Exception as ex:
        dbgout("`buy_stock("+ str(code) + ") -> exception! " + str(ex) + "`")

def sell_all():
    """보유한 모든 종목을 최유리 지정가 IOC 조건으로 매도한다."""
    try:
        cpTradeUtil.TradeInit()
        acc = cpTradeUtil.AccountNumber[0]       # 계좌번호
        accFlag = cpTradeUtil.GoodsList(acc, 1)  # -1:전체, 1:주식, 2:선물/옵션
        while True:
            stocks = get_stock_balance('Sell')
            total_qty = 0
            for s in stocks:
                total_qty += s['qty']
            if total_qty == 0:
                return True
            for s in stocks:
                if s['qty'] != 0:
                    cpOrder.SetInputValue(0, "1")         # 1:매도, 2:매수
                    cpOrder.SetInputValue(1, acc)         # 계좌번호
                    cpOrder.SetInputValue(2, accFlag[0])  # 주식상품 중 첫번째
                    cpOrder.SetInputValue(3, s['code'])   # 종목코드
                    cpOrder.SetInputValue(4, s['qty'])    # 매도수량
                    cpOrder.SetInputValue(7, "1")   # 조건 0:기본, 1:IOC, 2:FOK
                    cpOrder.SetInputValue(8, "12")  # 호가 12:최유리, 13:최우선
                    # 최유리 IOC 매도 주문 요청
                    ret = cpOrder.BlockRequest()
                    rqStatus = cpOrder.GetDibStatus()
                    orderMsg = cpOrder.GetDibMsg1()
                    if rqStatus == 0:
                        if ret == 4:
                            remain_time = cpStatus.LimitRequestRemainTime
                            printlog('주의: 연속 주문 제한, 대기시간:', remain_time/1000)
                        else:
                            dbgout("`매도 : "+ str(s['name']) + ", 수량 : " + str(s['qty']) + "`")
                    else:
                        printlog("매도 실패 : ", orderMsg)
                time.sleep(1)
            time.sleep(30)
    except Exception as ex:
        dbgout("sell_all() -> exception! " + str(ex))

if __name__ == '__main__':
    try:
        dbgout('`meeseeks_CreonOrder_ver_2.0 is running ~`')
        symbol_list = MarketDB().get_buy_list().list[0].split(',')
        if str(MarketDB().yesterday_keep_list().keep_stock[0]) == 'None':
            keep_list = []
            bought_list = []
        else:
            keep_list = MarketDB().yesterday_keep_list().keep_stock[0]
            bought_list = MarketDB().yesterday_keep_list().keep_stock[0]
        target_buy_count = 5 # 매수할 종목 수
        buy_percent = 0.19
        printlog('check_creon_system() :', check_creon_system())  # 크레온 접속 점검
        stocks = get_stock_balance('ALL')      # 보유한 모든 종목 조회
        total_cash = int(get_current_cash())   # 100% 증거금 주문 가능 금액 조회
        initial_total = int(get_current_total())
        buy_amount = total_cash * buy_percent  # 종목별 주문 금액 계산
        printlog('100% 증거금 주문 가능 금액 : ', total_cash)
        printlog('종목별 주문 비율 : ', buy_percent)
        printlog('종목별 주문 금액 : ', buy_amount)
        printlog('시작 시간 : ', datetime.now().strftime('%m/%d %H:%M:%S'))
        oneLoop = False
        t_now = datetime.now()
        t_log_start = t_now.replace(hour=8, minute=50, second=0, microsecond=0)
        t_9 = t_now.replace(hour=9, minute=0, second=0, microsecond=0)
        t_start = t_now.replace(hour=9, minute=5, second=0, microsecond=0)
        t_sell = t_now.replace(hour=15, minute=15, second=0, microsecond=0)
        t_sell_end = t_now.replace(hour=15, minute=20, second=0,microsecond=0)
        t_exit = t_now.replace(hour=15, minute=30, second=0,microsecond=0)
        today = datetime.today().weekday()
        if today == 5 or today == 6:  # 토요일이나 일요일이면 자동 종료
            printlog('Today is ', 'Saturday.' if today == 5 else 'Sunday.')
            dbgout('`WEEKEND -> 프로그램을 종료합니다.`')
            sys.exit(0)
        while True:
            now = datetime.now()
            if t_log_start < now < t_9 and oneLoop == False:
                if MarketDB().trade_log_start() == True:
                    oneLoop = True
            if t_9 < now < t_start and oneLoop == True:
                if sell_all() == True:
                    oneLoop = False
                    keep_list = []
                    dbgout('장시작 전 전량 매도 완료!')
                    time.sleep(2)
            if t_start < now < t_sell :  # AM 09:05 ~ PM 03:15 : 매수
                if now.minute == 00 and 0 <= now.second <= 59:
                    alarm = get_stock_balance('ALL')
                    MarketDB().trade_log_keep(keep_list)
                    time.sleep(60)
                for sym in symbol_list:
                    if len(bought_list) < target_buy_count:
                        if buy_stock(sym) == True:
                            time.sleep(1)
                        else:
                            time.sleep(1)
                    else:
                        if oneLoop == False:
                            if MarketDB().trade_log_middle() == True:
                                oneLoop = True
            if t_sell < now < t_sell_end and oneLoop == True:  # PM 03:15 ~ PM 03:20 : 일괄 매도
                if sell_all() == True:
                    dbgout('`매도 완료!`')
                    oneLoop = False
            if t_sell_end < now < t_exit and oneLoop == False:
                if MarketDB().trade_log_end(initial_total) == True:
                    oneLoop = True
            if t_exit < now:  # PM 03:30 ~ :프로그램 종료
                dbgout('`프로그램을 종료합니다.`')
                sys.exit(0)
            time.sleep(3)
    except Exception as ex:
        dbgout('`main함수 err!!! ' + str(ex) + '`')
