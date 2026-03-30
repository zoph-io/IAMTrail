FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal

RUN dnf install -y \
    git \
    jq \
    aws-cli \
    findutils \
    python3 \
    && dnf clean all \
    && rm -rf /var/cache/dnf

ENV AWS_REGION=eu-west-1

RUN groupadd -r mamipg && useradd --no-log-init -r -g mamipg -m -d /home/mamip mamip
USER mamip

WORKDIR /app

COPY --chown=mamip:mamipg script-fargate.sh /app/script.sh
RUN chmod +x /app/script.sh
RUN mkdir -p /home/mamip/.ssh

CMD ["bash", "script.sh"]
