import zlib
import struct

def make_png(width, height):
    # Simple blue pixel
    # RGBA: 0, 0, 255, 255
    pixel = b'\x00\x00\xff\xff'
    line = b'\x00' + pixel * width
    data = line * height
    
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr = struct.pack('!I4sIIBBBBB', 13, b'IHDR', width, height, 8, 6, 0, 0, 0)
    ihdr += struct.pack('!I', zlib.crc32(ihdr[4:]))
    png += ihdr
    
    # IDAT chunk
    compressed = zlib.compress(data)
    idat = struct.pack('!I4s', len(compressed), b'IDAT') + compressed
    idat += struct.pack('!I', zlib.crc32(idat[4:]))
    png += idat
    
    # IEND chunk
    iend = struct.pack('!I4s', 0, b'IEND')
    iend += struct.pack('!I', zlib.crc32(iend[4:]))
    png += iend
    
    return png

with open('icon.png', 'wb') as f:
    f.write(make_png(512, 512))

print("icon.png generated")
