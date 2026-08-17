import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";

// CMS: news, gallery, sponsors, FAQs


const NEWS_WRITABLE_FIELDS = [
  "seasonId", "teamId", "title", "slug", "excerpt", "content", "imageUrl",
  "author", "isFeatured", "isPublished", "publishedAt",
] as const;

export const getNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { search } = req.query;
    const where: any = {};
    if (search) where.OR = [
      { title: { contains: search as string, mode: "insensitive" } },
      { author: { contains: search as string, mode: "insensitive" } },
      { excerpt: { contains: search as string, mode: "insensitive" } },
    ];
    const [data, total] = await Promise.all([
      prisma.news.findMany({
        where,
        include: { team: { select: { name: true, slug: true } } },
        skip, take: limit,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.news.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, NEWS_WRITABLE_FIELDS);
    if (!data.title || !data.slug) throw new AppError("title and slug are required", 400);
    if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
    const news = await prisma.news.create({ data });
    res.status(201).json(news);
  } catch (error) {
    next(error);
  }
};

export const updateNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, NEWS_WRITABLE_FIELDS);
    if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data,
    });
    res.json(news);
  } catch (error) {
    next(error);
  }
};

export const deleteNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const GALLERY_WRITABLE_FIELDS = [
  "seasonId", "teamId", "playerId", "fixtureId", "awardId", "title", "imageUrl", "videoUrl", "isActive",
] as const;

export const getGalleryItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.gallery.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const manageGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, GALLERY_WRITABLE_FIELDS);
    if (!data.title || !data.imageUrl) throw new AppError("title and imageUrl are required", 400);
    const item = await prisma.gallery.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteGalleryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateGalleryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.gallery.update({ where: { id: req.params.id }, data: pick(req.body, GALLERY_WRITABLE_FIELDS) as any });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const SPONSOR_WRITABLE_FIELDS = ["teamId", "name", "logoUrl", "website", "tier", "isActive"] as const;

export const manageSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, SPONSOR_WRITABLE_FIELDS);
    if (!data.name || !data.logoUrl) throw new AppError("name and logoUrl are required", 400);
    const sponsor = await prisma.sponsor.create({ data });
    res.status(201).json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const updateSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsor = await prisma.sponsor.update({
      where: { id: req.params.id },
      data: pick(req.body, SPONSOR_WRITABLE_FIELDS) as any,
    });
    res.json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const getSponsors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
    ];
    const sponsors = await prisma.sponsor.findMany({ where, orderBy: { tier: "asc" } });
    res.json({ data: sponsors });
  } catch (error) {
    next(error);
  }
};

export const deleteSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.sponsor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const FAQ_WRITABLE_FIELDS = ["question", "answer", "category", "order", "isActive"] as const;

export const getFaqs = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.faq.findMany({ orderBy: { order: "asc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, FAQ_WRITABLE_FIELDS);
    if (!data.question || !data.answer) throw new AppError("question and answer are required", 400);
    const item = await prisma.faq.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.faq.update({ where: { id: req.params.id }, data: pick(req.body, FAQ_WRITABLE_FIELDS) as any });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.faq.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
