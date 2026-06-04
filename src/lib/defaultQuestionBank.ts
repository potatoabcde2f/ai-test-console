import type { QuestionCategory, Question } from "../types";
import { uid } from "./ids";

// 意图识别分类的20条常见问题
const INTENT_QUESTIONS: string[] = [
  "这件衣服怎么搭",
  "生成这件衣服的穿搭图片",
  "灰色衬衫可以搭白色裤子吗",
  "这条裙子适合什么场合",
  "帮我配一套职场穿搭",
  "这件外套配什么鞋子好看",
  "推荐几套适合约会的穿搭",
  "这件T恤配牛仔裤怎么样",
  "帮我生成一套运动风穿搭图",
  "黑色大衣怎么搭配不显老气",
  "这件连衣裙适合配什么包包",
  "帮我搭配一套面试穿搭",
  "生成这套衣服的试穿效果",
  "米色毛衣配什么颜色外套",
  "这套穿搭适合什么季节",
  "帮我配一套休闲周末穿搭",
  "这件衬衫可以配西装裤吗",
  "生成适合海边度假的穿搭图",
  "这套衣服配什么首饰好看",
  "帮我搭配一套见家长的穿搭",
];

export function createIntentQuestionCategory(): QuestionCategory {
  const questions: Question[] = INTENT_QUESTIONS.map((content) => ({
    id: uid("q"),
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  return {
    id: uid("cat"),
    name: "意图识别",
    questions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const DEFAULT_QUESTION_BANK = {
  categories: [createIntentQuestionCategory()],
};
