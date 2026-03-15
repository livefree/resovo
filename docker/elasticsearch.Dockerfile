FROM elasticsearch:8.17.0

# Install IK analysis plugin (Chinese tokenizer)
RUN elasticsearch-plugin install --batch \
    https://release.infinilabs.com/analysis-ik/stable/elasticsearch-analysis-ik-8.17.0.zip

# Install Pinyin analysis plugin
RUN elasticsearch-plugin install --batch \
    https://release.infinilabs.com/analysis-pinyin/stable/elasticsearch-analysis-pinyin-8.17.0.zip
