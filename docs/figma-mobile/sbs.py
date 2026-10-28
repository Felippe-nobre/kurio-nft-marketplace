import sys
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]
for n in ['Inicio','Detalhes_do_NFT','Carrinho_de_NFTs','Pagamento','Login','Cadastro']:
    a = Image.open(f'/home/claude/figma/ref/{n}.png').convert('RGB'); b = Image.open(f'{src}/{n}.png').convert('RGB')
    c = Image.new('RGB', (a.width + b.width + 20, max(a.height, b.height)), (255, 255, 255))
    c.paste(a, (0, 0)); c.paste(b, (a.width + 20, 0)); c.save(f'{out}/sbs_{n}.png')
