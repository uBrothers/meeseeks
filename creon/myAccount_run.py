import os, sys, ctypes
import win32com.client
import pandas as pd
from datetime import datetime
from slacker import Slacker
import time, calendar
from bs4 import BeautifulSoup
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import pymysql

slack = Slacker('xoxb-1398877919094-1406719016898-vSj7JEDRgOSEeK6MTDOygRng')

def dbgout(message):
    """인자로 받은 문자열을 파이썬 셸과 슬랙으로 동시에 출력한다."""
    print(datetime.now().strftime('[%m/%d %H:%M:%S]'), message)
    strbuf = datetime.now().strftime('[%m/%d %H:%M:%S] ') + message
    slack.chat.post_message('#meeseeks-bot', strbuf)

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

def get_stock_balance(code):
    """인자로 받은 종목의 종목명과 수량을 반환한다."""
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
        if stock_code == code:
            return stock_name, stock_qty
    if code == 'ALL':
        return stocks
    else:
        stock_name = cpCodeMgr.CodeToName(code)
        return stock_name, 0

if __name__ == '__main__':
    try:
        printlog('myAccount Status : ', check_creon_system())  # 크레온 접속 점검
        dbgout('`myAccount를 시작합니다.`')
        while True:
            t_now = datetime.now()
            t_start = t_now.replace(hour=9, minute=5, second=0, microsecond=0)
            t_sell = t_now.replace(hour=15, minute=15, second=0, microsecond=0)
            t_exit = t_now.replace(hour=15, minute=20, second=0,microsecond=0)
            today = datetime.today().weekday()
            if today == 5 or today == 6:  # 토요일이나 일요일이면 자동 종료
                printlog('Today is ', 'Saturday.' if today == 5 else 'Sunday.')
                sys.exit(0)
            if t_start < t_now < t_sell :  # AM 09:05 ~ PM 03:15 : 매수
                if t_now.minute == 30 and 0 <= t_now.second <= 5:
                    alarm = get_stock_balance('ALL')
                    time.sleep(5)
            if t_exit < t_now:  # PM 03:20 ~ :프로그램 종료
                dbgout('`myAccount를 종료합니다.`')
                sys.exit(0)
            time.sleep(3)
    except Exception as ex:
        dbgout('`main -> exception! ' + str(ex) + '`')
