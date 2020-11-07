# meeseeks
stock system trading

using nodeJS

using mariaDB	>mysql -u root -p

using krx-stock-api ( https://github.com/Shin-JaeHeon/krx-stock-api )

mariaDB wait_timeout=288000

$  sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf

 [mysqld]
 interactive_timeout = [설정값]
 wait_timeout = [설정값]

$  sudo service mysql restart

 ***@ubuntu :~ $  sudo mysql -uroot

 MariaDB [(none)]> show variables like '%timeout';

Time Zone settings
	https://jwkim96.tistory.com/23
