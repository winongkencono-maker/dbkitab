// Use dynamic import for Xenova Transformers since it's an ESM module
let pipeline;

async function initEmbedder() {
    if (!pipeline) {
        console.log("Loading Xenova AI Model for Semantic Search...");
        const transformers = await import('@xenova/transformers');
        // We use the same model as our python script, converted to ONNX format
        pipeline = await transformers.pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
        console.log("Model loaded successfully!");
    }
    return pipeline;
}

async function getEmbedding(text) {
    const pipe = await initEmbedder();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    // Convert Float32Array to standard JS Array
    return Array.from(output.data);
}

module.exports = {
    initEmbedder,
    getEmbedding
};
