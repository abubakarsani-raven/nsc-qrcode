import bwipjs from "bwip-js";

export async function code128Png(text: string, widthPx = 420, heightPx = 80) {
  return bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 2,
    height: 10,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
}
