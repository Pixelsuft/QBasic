import eel

@eel.expose
def cor_textshot(txt):
    i=1
    while True:
        try:
            open('textshot_'+str(i)+'.txt', 'r')
            i+=1
        except:
            break
    f = open('textshot_'+str(i)+'.txt', 'w', encoding='utf-8')
    f.write(txt)

eel.init('source')
eel.start('index.html', mode='chrome', size=(1024, 768))