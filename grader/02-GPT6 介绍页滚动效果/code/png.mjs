import zlib from 'node:zlib';

// Read Chromium's 8-bit RGB/RGBA screenshots for rendered-color checks.
export function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Not a PNG');
  let width, height, channels, offset=8;
  const chunks=[];
  while (offset < bytes.length) {
    const length=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
    const data=bytes.subarray(offset+8,offset+8+length);
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);if(data[8]!==8||![2,6].includes(data[9])||data[12]!==0)throw Error('Unsupported PNG format');channels=data[9]===6?4:3;}
    if(type==='IDAT')chunks.push(data);
    offset+=length+12;
    if(type==='IEND')break;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)), stride=width*channels, pixels=Buffer.alloc(width*height*channels);
  let src=0;
  for(let y=0;y<height;y++){
    const filter=raw[src++], row=y*stride, previous=row-stride;
    for(let x=0;x<stride;x++){
      const left=x>=channels?pixels[row+x-channels]:0;
      const up=y?pixels[previous+x]:0;
      const upLeft=y&&x>=channels?pixels[previous+x-channels]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      else if(filter===2)predictor=up;
      else if(filter===3)predictor=Math.floor((left+up)/2);
      else if(filter===4){const p=left+up-upLeft,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upLeft);predictor=a<=b&&a<=c?left:b<=c?up:upLeft;}
      else if(filter!==0)throw Error('Unsupported PNG filter');
      pixels[row+x]=(raw[src++]+predictor)&255;
    }
  }
  return {width,height,channels,pixels};
}

export function blueCoverage(image, line) {
  const x0=Math.max(0,Math.ceil(line.x)), x1=Math.min(image.width,Math.floor(line.right));
  const y0=Math.max(0,Math.ceil(line.y+line.height*.18)), y1=Math.min(image.height,Math.floor(line.y+line.height*.82));
  let blueColumns=0, total=Math.max(0,x1-x0);
  for(let x=x0;x<x1;x++){
    let blue=false;
    for(let y=y0;y<y1;y++){
      const i=(y*image.width+x)*image.channels,r=image.pixels[i],g=image.pixels[i+1],b=image.pixels[i+2];
      if(r>95&&r<225&&g>125&&b>g+17&&b>r+28){blue=true;break;}
    }
    if(blue)blueColumns++;
  }
  return total?blueColumns/total:0;
}
