from modules import Analyzer
stockPrice = Analyzer.MarketDB()
data=stockPrice.get_daily_price('삼성전자', '2020-09-25', '2020-10-03')
print(data)
