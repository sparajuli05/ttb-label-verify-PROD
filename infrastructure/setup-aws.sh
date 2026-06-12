#!/usr/bin/env bash
# One-time AWS setup for TTB Label Verify (all Free Tier eligible).
# Creates: S3 bucket with static website hosting + public read policy,
# and a least-privilege IAM user for CI/CD deploys.
#
# Prereqs: AWS CLI v2 installed and `aws configure` done with an admin profile.
# Usage:   bash infrastructure/setup-aws.sh ttb-label-verify-<yourname> us-east-1

set -euo pipefail

BUCKET="${1:?Usage: setup-aws.sh <bucket-name> <region>}"
REGION="${2:-us-east-1}"

echo "==> Creating S3 bucket: $BUCKET ($REGION)"
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

echo "==> Enabling static website hosting"
aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html

echo "==> Allowing public reads (required for S3 website endpoint)"
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicReadGetObject\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET/*\"
  }]
}"

echo "==> Creating least-privilege IAM deploy user: ttb-verify-deployer"
aws iam create-user --user-name ttb-verify-deployer || true
aws iam put-user-policy --user-name ttb-verify-deployer \
  --policy-name ttb-verify-deploy --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:PutObject\", \"s3:DeleteObject\", \"s3:ListBucket\", \"s3:GetObject\"],
      \"Resource\": [\"arn:aws:s3:::$BUCKET\", \"arn:aws:s3:::$BUCKET/*\"]
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"cloudfront:CreateInvalidation\"],
      \"Resource\": \"*\"
    }
  ]
}"

echo "==> Creating access key for CI/CD (store these as GitHub secrets!)"
aws iam create-access-key --user-name ttb-verify-deployer \
  --query 'AccessKey.{AWS_ACCESS_KEY_ID:AccessKeyId,AWS_SECRET_ACCESS_KEY:SecretAccessKey}' \
  --output table

echo ""
echo "Done. Your site URL after first deploy:"
echo "  http://$BUCKET.s3-website-$REGION.amazonaws.com"
echo ""
echo "Add the access keys above + AWS_REGION=$REGION + S3_BUCKET=$BUCKET"
echo "as GitHub Actions secrets, then push to main."
