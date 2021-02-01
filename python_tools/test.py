
import discord
def main():
    client = discord.Client()

    token = "ODA1MzY2MzQ5MjExNTAwNTg0.YBZ13A.IUOPl3mw-HnyqDP5aWgrgKblYck"


    # 봇이 새로운 메시지를 수신했을때 동작되는 코드
    @client.event
    async def on_message(message):
        channel = message.channel #
        message.channel.id = '805368618409525258'

        await client.send_message(message.channel, "시발")

    #client 실행
    client.run(token)
if __name__ == '__main__':
    main()
