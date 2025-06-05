import { TransformerChain } from './base';
import { 
  CDPBinaryTransformer, 
  CDPMetricsTransformer, 
  CDPConsoleTransformer 
} from './cdp-transformer';
import { 
  PuppeteerScreenshotTransformer, 
  PuppeteerNavigationTransformer,
  PuppeteerEvaluateTransformer
} from './puppeteer-transformer';

export function createDefaultTransformers(): TransformerChain {
  const chain = new TransformerChain();
  
  // CDP transformers
  chain.add(new CDPBinaryTransformer());
  chain.add(new CDPMetricsTransformer());
  chain.add(new CDPConsoleTransformer());
  
  // Puppeteer transformers
  chain.add(new PuppeteerScreenshotTransformer());
  chain.add(new PuppeteerNavigationTransformer());
  chain.add(new PuppeteerEvaluateTransformer());
  
  return chain;
}

export { TransformerChain, ResponseTransformer, TransformContext } from './base';